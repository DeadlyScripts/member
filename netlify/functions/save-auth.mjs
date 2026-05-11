import { getStore } from "@netlify/blobs";

/**
 * POST /save-auth
 * Called by the Python bot whenever it wants to upsert a user into the pull stock.
 * Body: { user_id, username, access_token, refresh_token }
 * Header: Authorization: <API_SECRET>
 */
export default async (req) => {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== process.env.API_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { user_id, username = "unknown", access_token, refresh_token } = body;

  if (!user_id || !access_token || !refresh_token) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }

  try {
    const store = getStore("auths");
    await store.setJSON(user_id, {
      user_id,
      username,
      access_token,
      refresh_token,
      saved_at: new Date().toISOString(),
    });

    console.log(`save-auth: upserted ${username} (${user_id})`);
    return Response.json({ ok: true, username });

  } catch (e) {
    console.error("Blobs save error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const config = { path: "/save-auth" };
