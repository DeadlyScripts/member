import { getStore } from "@netlify/blobs";

export default async (req) => {
  // Protect with a secret key so only your bot can read tokens
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (key !== process.env.API_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const store  = getStore("auths");
    const listed = await store.list();
    const auths  = [];

    for (const entry of listed.blobs) {
      const data = await store.get(entry.key, { type: "json" });
      if (data) auths.push(data);
    }

    return new Response(JSON.stringify(auths), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/get-auths" };
