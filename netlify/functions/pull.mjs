import { getStore } from "@netlify/blobs";

/**
 * GET /pull?key=SECRET&guild_id=123&amount=10
 * Validates + refreshes tokens before pulling.
 * Deauthed users are removed from stock on the spot.
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

  const BOT_TOKEN     = process.env.BOT_TOKEN;
  const CLIENT_ID     = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;

  if (!BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "BOT_TOKEN not set" }), { status: 500 });
  }

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

    let access_token  = auth.access_token;
    let refresh_token = auth.refresh_token;

    // ── Step 1: validate token ─────────────────────────────────────────────
    const check = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (check.status === 401) {
      // ── Step 2: try refresh ──────────────────────────────────────────────
      let refreshed = false;

      if (CLIENT_ID && CLIENT_SECRET && refresh_token) {
        const ref = await fetch("https://discord.com/api/oauth2/token", {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id:     CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type:    "refresh_token",
            refresh_token,
          }),
        });

        if (ref.ok) {
          const t = await ref.json();
          if (t.access_token && t.refresh_token) {
            access_token  = t.access_token;
            refresh_token = t.refresh_token;
            await store.setJSON(auth.user_id, {
              ...auth,
              access_token,
              refresh_token,
              saved_at: new Date().toISOString(),
            });
            refreshed = true;
          }
        }
      }

      // ── Step 3: still dead — remove from stock ───────────────────────────
      if (!refreshed) {
        await store.delete(auth.user_id);
        removed++;
        console.log(`Removed deauthorized user ${auth.username} (${auth.user_id})`);
        continue;
      }
    }

    // ── Step 4: add to guild ───────────────────────────────────────────────
    const res = await fetch(`https://discord.com/api/guilds/${guild_id}/members/${auth.user_id}`, {
      method:  "PUT",
      headers: {
        "Authorization": `Bot ${BOT_TOKEN}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ access_token }),
    });

    if (res.status === 201) {
      added++;
      addedUsers.push(auth.username);
    } else if (res.status === 204) {
      skipped++;
    } else if (res.status === 401) {
      await store.delete(auth.user_id);
      removed++;
      console.log(`Removed deauthorized user ${auth.username} (${auth.user_id})`);
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
    total: auths.length - removed,
    users: addedUsers,
  });
};

export const config = { path: "/pull" };
