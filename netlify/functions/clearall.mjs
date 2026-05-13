import { getStore } from "@netlify/blobs";

/**
 * GET /clearall?key=SECRET
 * Removes every user from the stock.
 */
export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (key !== process.env.API_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const store  = getStore("auths");
  const listed = await store.list();
  let removed  = 0;

  for (const entry of listed.blobs) {
    await store.delete(entry.key);
    removed++;
  }

  console.log(`clearall: removed ${removed} users from stock`);
  return Response.json({ ok: true, removed });
};

export const config = { path: "/clearall" };
