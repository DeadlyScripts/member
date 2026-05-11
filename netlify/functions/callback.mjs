import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const url    = new URL(req.url);
  const code   = url.searchParams.get("code");

  if (!code) {
    return new Response(JSON.stringify({ error: "No code provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Exchange code for tokens (server-side — secret is safe here)
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type:    "authorization_code",
        code:          code,
        redirect_uri:  process.env.DISCORD_REDIRECT_URI,
        scope:         "identify guilds.join",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Discord token exchange failed: ${err}`);
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token } = tokens;

    // Fetch user info
    const userRes  = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user     = await userRes.json();
    const user_id  = user.id;
    const username = user.username ?? "unknown";

    // Store in Netlify Blobs (keyed by user_id so it auto-upserts)
    const store = getStore("auths");
    await store.setJSON(user_id, { user_id, username, access_token, refresh_token });

    return new Response(JSON.stringify({ ok: true, username }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://memberz.netlify.app",
      },
    });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/callback" };
