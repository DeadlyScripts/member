import { getStore } from "@netlify/blobs";

const runCleanup = async () => {
  const store  = getStore("auths");
  const listed = await store.list();
  const auths  = [];

  for (const entry of listed.blobs) {
    const data = await store.get(entry.key, { type: "json" });
    if (data) auths.push(data);
  }

  let removed = 0, kept = 0;

  for (const auth of auths) {
    const res = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });

    if (res.status === 401) {
      await store.delete(auth.user_id);
      removed++;
      console.log(`Removed deauthorized user ${auth.username} (${auth.user_id})`);
    } else {
      kept++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`Cleanup done: removed ${removed}, kept ${kept}`);
  return { removed, kept };
};

// ── Manual trigger via GET /cleanup?key=SECRET ────────────────────────────
export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (key !== process.env.API_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const result = await runCleanup();
  return Response.json({ ok: true, ...result });
};

// ── Automatic scheduled run every hour ───────────────────────────────────
export const config = {
  path:     "/cleanup",
  schedule: "*/5 * * * *",  // every hour
};
