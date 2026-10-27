// Password-gated token vendor for the /manage/ content editor, deployed as a
// Cloudflare Pages Function. Checks a shared password against a secret set in
// the Cloudflare dashboard, and if correct, hands back a GitHub Personal
// Access Token (also stored as a secret) that has write access to this repo.
// This lets a non-technical person get full editor access with just a
// password, without ever needing their own GitHub account or token.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!env.MANAGE_PASSWORD) {
    return json({ error: "Server is missing the MANAGE_PASSWORD secret" }, 500);
  }

  if (!body.password || body.password !== env.MANAGE_PASSWORD) {
    return json({ error: "Incorrect password" }, 401);
  }

  if (!env.GITHUB_PAT) {
    return json({ error: "Server is missing the GITHUB_PAT secret" }, 500);
  }

  return json({ token: env.GITHUB_PAT }, 200);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
