import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (key !== process.env.API_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const store  = getStore("auths");
  const listed = await store.list();

  return Response.json({ count: listed.blobs.length });
};

export const config = { path: "/count" };
