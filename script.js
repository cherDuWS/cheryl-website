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
const releaseFeature = document.querySelector(".release-feature");
const releaseList = document.querySelector(".release-list");
if (releaseFeature || releaseList) {
  fetch("content/releases.json")
    .then((res) => res.json())
    .then((data) => {
      if (releaseFeature && data.upcoming) {
        const upcoming = data.upcoming;
        releaseFeature.querySelector(".release-feature-media img").src = upcoming.image;
        releaseFeature.querySelector(".release-feature-media img").alt = upcoming.title;
        releaseFeature.querySelector(".eyebrow").textContent = upcoming.label;
        releaseFeature.querySelector("h3").textContent = upcoming.title;
        releaseFeature.querySelector(".release-date").textContent = upcoming.date;

        const upcomingLink = releaseFeature.querySelector(".btn-outline");
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

// Gig guide — fetched from content/gigs.json (editable via the CMS at /admin)
const gigList = document.querySelector(".gig-list");
if (gigList) {
  fetch("content/gigs.json")
    .then((res) => res.json())
    .then((data) => {
      gigList.innerHTML = "";

      data.gigs.forEach((gig) => {
        const li = document.createElement("li");

        const dateEl = document.createElement("span");
        dateEl.className = "gig-date";
        dateEl.textContent = gig.date;

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
