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

// ── Automatic scheduled run every 5 minutes ──────────────────────────────
export default async () => {
  await runCleanup();
};

export const config = {
  schedule: "*/5 * * * *",
};
