// Header boundary line — only visible once the page has scrolled past the top
const header = document.querySelector(".site-header");
if (header) {
  const updateHeaderScrollState = () => {
    header.classList.toggle("scrolled", window.scrollY > 0);
  };
  updateHeaderScrollState();
  window.addEventListener("scroll", updateHeaderScrollState, { passive: true });
}

// Releases (upcoming + previous) — fetched from content/releases.json (editable via the CMS at /admin)
const upcomingRelease = document.querySelector(".upcoming-release");
const releaseList = document.querySelector(".release-list");
if (upcomingRelease || releaseList) {
  fetch("content/releases.json")
    .then((res) => res.json())
    .then((data) => {
      // "upcoming" is a list capped at one entry in the CMS, so it can be left
      // empty to hide this section entirely instead of always showing something.
      const upcoming = upcomingRelease && data.upcoming && data.upcoming[0];

      if (upcomingRelease) {
        upcomingRelease.hidden = !upcoming;
      }

      if (upcoming) {
        upcomingRelease.querySelector(".release-feature-media img").src = upcoming.image;
        upcomingRelease.querySelector(".release-feature-media img").alt = upcoming.title;
        upcomingRelease.querySelector(".eyebrow").textContent = upcoming.label;
        upcomingRelease.querySelector("h3").textContent = upcoming.title;
        upcomingRelease.querySelector(".release-date").textContent = upcoming.date;

        const upcomingLink = upcomingRelease.querySelector(".btn-outline");
        upcomingLink.href = upcoming.link;
        upcomingLink.textContent = `${upcoming.label} →`;
      }

      if (!releaseList) return;

      releaseList.innerHTML = "";

      data.releases.forEach((release) => {
        const li = document.createElement("li");

        const imgEl = document.createElement("img");
        imgEl.src = release.image;
        imgEl.alt = release.title;
        li.append(imgEl);

        const contentEl = document.createElement("div");
        contentEl.className = "release-list-content";

        const titleEl = document.createElement("h4");
        titleEl.textContent = release.title;
        contentEl.append(titleEl);

        if (release.award) {
          const awardEl = document.createElement("p");
          awardEl.textContent = release.award;
          contentEl.append(awardEl);
        }

        li.append(contentEl);

        const linkEl = document.createElement("a");
        linkEl.href = release.link;
        linkEl.target = "_blank";
        linkEl.rel = "noopener";
        linkEl.textContent = "Listen →";
        li.append(linkEl);

        releaseList.append(li);
      });
    })
    .catch((err) => console.error("Failed to load releases:", err));
}

// Gig guide — fetched from content/gigs.json (editable via the CMS at /admin).
// Gigs are stored with real ISO dates (plus an optional endDate for multi-day
// gigs) so past gigs can be automatically hidden once their date has passed —
// nothing needs to be manually deleted from the list.

// Returns a Date, or null if the string isn't a parseable date (e.g. hand-edited
// JSON with a malformed value like "Nov, 2026, 1"). Callers must handle null
// rather than let an Invalid Date silently compare as neither past nor future.
function parseDate(dateString, timeSuffix) {
  if (!dateString) return null;
  const d = new Date(`${dateString}${timeSuffix}`);
  return isNaN(d.getTime()) ? null : d;
}

function isGigPast(gig) {
  const referenceDate = parseDate(gig.endDate || gig.date, "T23:59:59");
  // Unknown/unparseable dates are treated as "not past" so a bad entry stays
  // visible (and obviously wrong) rather than silently vanishing forever.
  if (!referenceDate) return false;
  return referenceDate < new Date();
}

function formatGigDate(gig) {
  const monthDay = (isoDate) => {
    const d = parseDate(isoDate, "T00:00:00");
    if (!d) return null;
    return { month: d.toLocaleString("en-US", { month: "short" }), day: String(d.getDate()).padStart(2, "0") };
  };

  const start = monthDay(gig.date);
  // If the date can't be parsed, fall back to showing the raw stored value
  // (rather than "Invalid Date NaN") so a bad entry is obvious, not garbled.
  if (!start) return gig.date || "";
  if (!gig.endDate) return `${start.month} ${start.day}`;

  const end = monthDay(gig.endDate);
  if (!end) return `${start.month} ${start.day}`;

  return start.month === end.month
    ? `${start.month} ${start.day}–${end.day}`
    : `${start.month} ${start.day} – ${end.month} ${end.day}`;
}

const gigList = document.querySelector(".gig-list");
if (gigList) {
  fetch("content/gigs.json")
    .then((res) => res.json())
    .then((data) => {
      gigList.innerHTML = "";

      data.gigs
        .filter((gig) => !isGigPast(gig))
        .sort((a, b) => {
          const dateA = parseDate(a.date, "T00:00:00");
          const dateB = parseDate(b.date, "T00:00:00");
          // Gigs with an unparseable date sort to the end rather than breaking
          // the ordering of everything else.
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA - dateB;
        })
        .forEach((gig) => {
          const li = document.createElement("li");

          const dateEl = document.createElement("span");
          dateEl.className = "gig-date";
          dateEl.textContent = formatGigDate(gig);

          const nameEl = document.createElement("span");
          nameEl.className = "gig-name";
          nameEl.textContent = gig.name;

          li.append(dateEl, nameEl);

          if (gig.link) {
            const linkEl = document.createElement("a");
            linkEl.href = gig.link;
            linkEl.target = "_blank";
            linkEl.rel = "noopener";
            linkEl.textContent = `${gig.venue} →`;
            li.append(linkEl);
          } else {
            const venueEl = document.createElement("span");
            venueEl.className = "gig-venue";
            venueEl.textContent = gig.venue;
            li.append(venueEl);
          }

          gigList.append(li);
        });
    })
    .catch((err) => console.error("Failed to load gigs:", err));
}

// Mobile nav toggle
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

// Contact form — submits to Web3Forms (https://web3forms.com) via fetch so the
// page never redirects. Requires a real access_key in the hidden input in index.html.
const form = document.querySelector(".contact-form");
if (form) {
  const sendBtn = form.querySelector(".send-btn");
  const status = form.querySelector(".form-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const accessKey = form.querySelector('[name="access_key"]').value;
    if (!accessKey || accessKey === "YOUR-WEB3FORMS-ACCESS-KEY") {
      status.dataset.state = "error";
      status.textContent = "Form isn't set up yet — add a Web3Forms access key in index.html.";
      return;
    }

    sendBtn.disabled = true;
    status.dataset.state = "";
    status.textContent = "Sending…";

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      const result = await res.json();

      if (result.success) {
        status.dataset.state = "success";
        status.textContent = "Thanks — your message has been sent!";
        form.reset();
      } else {
        throw new Error(result.message || "Submission failed");
      }
    } catch (err) {
      status.dataset.state = "error";
      status.textContent = "Something went wrong — please try again or email directly.";
    } finally {
      sendBtn.disabled = false;
    }
  });
}
