import { getStore } from "@netlify/blobs";

/**
 * GET /cleanup-manual?key=SECRET
 * Manually trigger a cleanup of deauthorized users.
 */
export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (key !== process.env.API_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const store  = getStore("auths");
  const listed = await store.list();
  const auths  = [];

  for (const entry of listed.blobs) {
    const data = await store.get(entry.key, { type: "json" });
    if (data) auths.push(data);
  }

  let removed = 0, kept = 0;
  const removedUsers = [];

  for (const auth of auths) {
    const res = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });

    if (res.status === 401) {
      await store.delete(auth.user_id);
      removedUsers.push(auth.username);
      removed++;
    } else {
      kept++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return Response.json({
    ok: true,
    removed,
    kept,
    total_before: auths.length,
    removed_users: removedUsers,
  });
};

export const config = { path: "/cleanup-manual" };
