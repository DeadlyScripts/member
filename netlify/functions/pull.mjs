import { getStore } from "@netlify/blobs";

/**
 * GET /pull?key=SECRET&guild_id=123&amount=10
 * Pulls users from stock into the specified guild, skipping anyone already in it.
 * Automatically removes users whose tokens are invalid (deauthorized).
 */
export default async (req) => {
  const url      = new URL(req.url);
  const key      = url.searchParams.get("key");
  const guild_id = url.searchParams.get("guild_id");
  const amount   = parseInt(url.searchParams.get("amount") || "1", 10);

  if (key !== process.env.API_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!guild_id) {
    return new Response(JSON.stringify({ error: "Missing guild_id" }), { status: 400 });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "BOT_TOKEN not set" }), { status: 500 });
  }

  // Fetch all auths from Blobs
  const store  = getStore("auths");
  const listed = await store.list();
  const auths  = [];

  for (const entry of listed.blobs) {
    const data = await store.get(entry.key, { type: "json" });
    if (data) auths.push(data);
  }

  if (auths.length === 0) {
    return Response.json({ ok: true, added: 0, skipped: 0, failed: 0, removed: 0, total: 0 });
  }

  // Shuffle
  auths.sort(() => Math.random() - 0.5);

  let added = 0, skipped = 0, failed = 0, removed = 0;
  const addedUsers = [];

  for (const auth of auths) {
    if (added >= amount) break;

    const res = await fetch(`https://discord.com/api/guilds/${guild_id}/members/${auth.user_id}`, {
      method:  "PUT",
      headers: {
        "Authorization": `Bot ${BOT_TOKEN}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ access_token: auth.access_token }),
    });

    if (res.status === 201) {
      // Newly added
      added++;
      addedUsers.push(auth.username);
    } else if (res.status === 204) {
      // Already in server
      skipped++;
    } else if (res.status === 401) {
      // Token invalid — user deauthorized the app, remove from stock
      await store.delete(auth.user_id);
      removed++;
      console.log(`Removed deauthorized user ${auth.username} (${auth.user_id}) from stock`);
    } else {
      failed++;
      console.log(`Failed to add ${auth.username}: ${res.status}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return Response.json({
    ok: true,
    added,
    skipped,
    failed,
    removed,
    total: auths.length,
    users: addedUsers,
  });
};

export const config = { path: "/pull" };
