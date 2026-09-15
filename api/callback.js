// Step 2 of the GitHub OAuth flow used by the Decap CMS admin panel (/admin).
// GitHub redirects here with a ?code=..., which is exchanged server-side for an
// access token (this must happen server-side — GitHub's token endpoint doesn't
// allow the browser to call it directly). The token is then handed back to the
// admin panel's popup window via the postMessage handshake Decap CMS expects.
export default async function handler(req, res) {
  const { code, error, error_description: errorDescription } = req.query;

  if (error) {
    res.status(400).send(`GitHub OAuth error: ${errorDescription || error}`);
    return;
  }

  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).send("Missing OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET environment variables.");
    return;
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const tokenData = await tokenRes.json();

  if (tokenData.error || !tokenData.access_token) {
    res.status(400).send(`OAuth error: ${tokenData.error_description || "unknown error"}`);
    return;
  }

  const payload = JSON.stringify({ token: tokenData.access_token, provider: "github" });

  const html = `<!doctype html>
<html>
<body>
<script>
  (function() {
    function receiveMessage(e) {
      window.opener.postMessage(
        "authorization:github:success:${payload.replace(/"/g, '\\"')}",
        e.origin
      );
      window.removeEventListener("message", receiveMessage, false);
    }
    window.addEventListener("message", receiveMessage, false);
    window.opener.postMessage("authorizing:github", "*");
  })();
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.status(200).send(html);
}
