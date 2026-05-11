import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url  = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

  const CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  // Must match EXACTLY what's in Discord Developer Portal → OAuth2 → Redirects
  const REDIRECT_URI  = "https://memberz.netlify.app/";

  // Exchange code for tokens
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    "authorization_code",
      code:          code,
      redirect_uri:  REDIRECT_URI,
    }),
  });

  const tokenData = await tokenRes.json();

  // Surface the real Discord error if exchange fails
  if (!tokenRes.ok) {
    console.error("Discord token error:", JSON.stringify(tokenData));
    return Response.json(
      { error: tokenData.error_description || tokenData.error || "Token exchange failed" },
      { status: 400 }
    );
  }

  const { access_token, refresh_token } = tokenData;

  // Fetch user info
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const user     = await userRes.json();
  const user_id  = user.id;
  const username = user.username ?? "unknown";

  // Save to Netlify Blobs
  try {
    const store = getStore("auths");
    await store.setJSON(user_id, { user_id, username, access_token, refresh_token });
  } catch (e) {
    console.error("Blob store error:", e.message);
    // Don't fail the auth just because blob storage errored
  }

  return Response.json({ ok: true, username });
};

export const config = { path: "/callback" };
