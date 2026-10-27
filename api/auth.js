// Step 1 of the GitHub OAuth flow used by the Decap CMS admin panel (/admin).
// Deploy this alongside api/callback.js (e.g. on Vercel) and set OAUTH_CLIENT_ID
// as an environment variable there — never commit the actual client secret.
export default function handler(req, res) {
  const clientId = process.env.OAUTH_CLIENT_ID;

  if (!clientId) {
    res.status(500).send("Missing OAUTH_CLIENT_ID environment variable.");
    return;
  }

  const redirectUri = `https://${req.headers.host}/api/callback`;
  const authorizeUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=repo` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.writeHead(302, { Location: authorizeUrl });
  res.end();
}
