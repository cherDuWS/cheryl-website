// Custom content manager — talks directly to the GitHub REST API to read and
// write content/gigs.json and content/releases.json. Access is gated by a
// shared password, checked by a small Cloudflare Pages Function
// (functions/api/login.js) which, if the password is correct, hands back a
// GitHub Personal Access Token that has write access to this repo.
//
// Security note: this stores that GitHub token in sessionStorage so it
// survives a page refresh within the same tab, but is cleared when the tab
// closes. The token has write access to this repo — the password is what
// protects it, so don't share it with anyone who shouldn't have that access.

const REPO = "cherDuWS/cheryl-website";
const BRANCH = "main";
const GIGS_PATH = "content/gigs.json";
const RELEASES_PATH = "content/releases.json";
const IMAGE_DIR = "assets/img";
const API_ROOT = "https://api.github.com";
const TOKEN_KEY = "cms_github_token";
// The login function (functions/api/login.js) only exists on Cloudflare Pages
// — it's not part of the GitHub Pages static site, so this page must always
// point at it by full URL rather than a relative path.
const LOGIN_BASE_URL = "https://cheryl-website.pages.dev";

let gigsState = { data: null, sha: null };
let releasesState = { data: null, sha: null };

// ---------- auth ----------

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function login(password) {
  const errorEl = document.getElementById("login-error");
  errorEl.hidden = true;

  const res = await fetch(`${LOGIN_BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    errorEl.textContent = body.error || "Login failed.";
    errorEl.hidden = false;
    return;
  }

  setToken(body.token);
  onLoggedIn();
}

function logout() {
  clearToken();
  window.location.reload();
}

// ---------- GitHub API helpers ----------

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToUtf8(base64) {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function githubRequest(path, options = {}) {
  const res = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Authorization: `token ${getToken()}`,
      Accept: "application/vnd.github+json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `GitHub API error (${res.status})`);
  }
  return res.json();
}

async function getFile(path) {
  const data = await githubRequest(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`);
  return { content: JSON.parse(base64ToUtf8(data.content)), sha: data.sha };
}

async function putFile(path, contentObj, sha, message) {
  return githubRequest(`/repos/${REPO}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: utf8ToBase64(`${JSON.stringify(contentObj, null, 2)}\n`),
      sha,
      branch: BRANCH,
    }),
  });
}

async function uploadImage(file) {
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.\-]+/g, "-");
  const path = `${IMAGE_DIR}/${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  const base64Content = btoa(binary);

  let existingSha;
  try {
    const existing = await githubRequest(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`);
    existingSha = existing.sha;
  } catch (e) {
    existingSha = undefined; // file doesn't exist yet, that's fine
  }

  await githubRequest(`/repos/${REPO}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Upload image ${safeName}`,
      content: base64Content,
      sha: existingSha,
      branch: BRANCH,
    }),
  });

  return path;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ---------- rendering: gigs ----------

function renderGigs() {
  const container = document.getElementById("gigs-list");
  container.innerHTML = "";

  gigsState.data.gigs.forEach((gig, i) => {
    const row = document.createElement("div");
    row.className = "edit-row";
    row.innerHTML = `
      <label>Date <input type="date" data-field="date" value="${escapeAttr(gig.date || "")}" /></label>
      <label>End Date <input type="date" data-field="endDate" value="${escapeAttr(gig.endDate || "")}" /></label>
      <label>Act / Event Name <input type="text" data-field="name" value="${escapeAttr(gig.name || "")}" /></label>
      <label>Venue <input type="text" data-field="venue" value="${escapeAttr(gig.venue || "")}" /></label>
      <label>Venue Link <input type="text" data-field="link" value="${escapeAttr(gig.link || "")}" /></label>
      <button type="button" class="remove-btn">Delete</button>
    `;

    row.querySelectorAll("input[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        gigsState.data.gigs[i][input.dataset.field] = input.value;
      });
    });

    row.querySelector(".remove-btn").addEventListener("click", () => {
      gigsState.data.gigs.splice(i, 1);
      renderGigs();
    });

    container.append(row);
  });
}

document.getElementById("add-gig-btn").addEventListener("click", () => {
  gigsState.data.gigs.push({ date: "", endDate: "", name: "", venue: "", link: "" });
  renderGigs();
});

document.getElementById("save-gigs-btn").addEventListener("click", async () => {
  const status = document.getElementById("gigs-status");
  status.textContent = "Saving…";
  try {
    const result = await putFile(GIGS_PATH, gigsState.data, gigsState.sha, "Update gigs via custom CMS");
    gigsState.sha = result.content.sha;
    status.textContent = "Saved!";
  } catch (err) {
    status.textContent = `Save failed: ${err.message}`;
  }
});

// ---------- rendering: previous releases ----------

function releaseRowHtml(release) {
  return `
    <label>Title <input type="text" data-field="title" value="${escapeAttr(release.title || "")}" /></label>
    <label>Award (optional) <input type="text" data-field="award" value="${escapeAttr(release.award || "")}" /></label>
    <label>Listen Link <input type="text" data-field="link" value="${escapeAttr(release.link || "")}" /></label>
    <label>Cover Image
      <img class="cover-preview" src="../${escapeAttr(release.image || "")}" alt="" />
      <input type="file" accept="image/*" class="image-upload" />
      <span class="image-path">${escapeAttr(release.image || "No image set")}</span>
    </label>
    <button type="button" class="remove-btn">Delete</button>
  `;
}

function wireReleaseRow(row, target, index, rerender) {
  row.querySelectorAll("input[data-field]").forEach((input) => {
    input.addEventListener("input", () => {
      target[index][input.dataset.field] = input.value;
    });
  });

  row.querySelector(".image-upload").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById("releases-status");
    status.textContent = "Uploading image…";
    try {
      const path = await uploadImage(file);
      target[index].image = path;
      rerender();
      status.textContent = "Image uploaded — remember to Save Changes.";
    } catch (err) {
      status.textContent = `Image upload failed: ${err.message}`;
    }
  });
}

function renderReleases() {
  const container = document.getElementById("releases-list");
  container.innerHTML = "";

  releasesState.data.releases.forEach((release, i) => {
    const row = document.createElement("div");
    row.className = "edit-row";
    row.innerHTML = releaseRowHtml(release);

    wireReleaseRow(row, releasesState.data.releases, i, renderReleases);
    row.querySelector(".remove-btn").addEventListener("click", () => {
      releasesState.data.releases.splice(i, 1);
      renderReleases();
    });

    container.append(row);
  });
}

document.getElementById("add-release-btn").addEventListener("click", () => {
  releasesState.data.releases.push({ title: "", image: "", award: "", link: "" });
  renderReleases();
});

// ---------- rendering: upcoming release (0 or 1 entry) ----------

function renderUpcoming() {
  const container = document.getElementById("upcoming-release");
  const addBtn = document.getElementById("add-upcoming-btn");
  container.innerHTML = "";

  if (!releasesState.data.upcoming || releasesState.data.upcoming.length === 0) {
    addBtn.hidden = false;
    container.innerHTML = '<p class="empty-hint">No upcoming release set — that section is hidden on the live site.</p>';
    return;
  }

  addBtn.hidden = true;
  const upcoming = releasesState.data.upcoming;
  const release = upcoming[0];

  const row = document.createElement("div");
  row.className = "edit-row";
  row.innerHTML = `
    <label>Title <input type="text" data-field="title" value="${escapeAttr(release.title || "")}" /></label>
    <label>Label <input type="text" data-field="label" value="${escapeAttr(release.label || "")}" /></label>
    <label>Release Date Text <input type="text" data-field="date" value="${escapeAttr(release.date || "")}" placeholder="e.g. Out October 23, 2026" /></label>
    <label>Link <input type="text" data-field="link" value="${escapeAttr(release.link || "")}" /></label>
    <label>Cover Image
      <img class="cover-preview" src="../${escapeAttr(release.image || "")}" alt="" />
      <input type="file" accept="image/*" class="image-upload" />
      <span class="image-path">${escapeAttr(release.image || "No image set")}</span>
    </label>
    <button type="button" class="remove-btn">Delete Upcoming Release</button>
  `;

  wireReleaseRow(row, upcoming, 0, renderUpcoming);
  row.querySelector(".remove-btn").addEventListener("click", () => {
    releasesState.data.upcoming = [];
    renderUpcoming();
  });

  container.append(row);
}

document.getElementById("add-upcoming-btn").addEventListener("click", () => {
  releasesState.data.upcoming = [{ title: "", label: "", date: "", image: "", link: "" }];
  renderUpcoming();
});

document.getElementById("save-releases-btn").addEventListener("click", async () => {
  const status = document.getElementById("releases-status");
  status.textContent = "Saving…";
  try {
    const result = await putFile(RELEASES_PATH, releasesState.data, releasesState.sha, "Update releases via custom CMS");
    releasesState.sha = result.content.sha;
    status.textContent = "Saved!";
  } catch (err) {
    status.textContent = `Save failed: ${err.message}`;
  }
});

// ---------- tabs ----------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => { p.hidden = true; });
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).hidden = false;
  });
});

// ---------- bootstrapping ----------

async function onLoggedIn() {
  document.getElementById("login-prompt").hidden = true;
  document.getElementById("login-form").hidden = true;
  document.getElementById("logout-btn").hidden = false;
  document.getElementById("manage-main").hidden = false;

  const gigsStatus = document.getElementById("gigs-status");
  const releasesStatus = document.getElementById("releases-status");
  gigsStatus.textContent = "Loading…";
  releasesStatus.textContent = "Loading…";

  try {
    const gigsFile = await getFile(GIGS_PATH);
    gigsState = { data: gigsFile.content, sha: gigsFile.sha };
    renderGigs();
    gigsStatus.textContent = "";
  } catch (err) {
    gigsStatus.textContent = `Failed to load gigs: ${err.message}`;
  }

  try {
    const releasesFile = await getFile(RELEASES_PATH);
    releasesState = { data: releasesFile.content, sha: releasesFile.sha };
    renderReleases();
    renderUpcoming();
    releasesStatus.textContent = "";
  } catch (err) {
    releasesStatus.textContent = `Failed to load releases: ${err.message}`;
  }
}

document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const passwordInput = document.getElementById("password-input");
  login(passwordInput.value);
  passwordInput.value = "";
});
document.getElementById("logout-btn").addEventListener("click", logout);

if (getToken()) {
  onLoggedIn();
}
