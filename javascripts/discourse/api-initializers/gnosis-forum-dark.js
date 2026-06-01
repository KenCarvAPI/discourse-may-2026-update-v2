import { apiInitializer } from "discourse/lib/api";

// Gnosis Forum Dark — DOM enhancements
// Kept deliberately defensive so it survives Discourse version changes.
//   - top category bar: inserted after the site header
//   - hero: prepended to #main-outlet (off by default; the search banner
//     already serves as the homepage welcome)
//   - category boxes: tagged with gn-cat-<slug>, and the four surfaced cards
//     get their label + subtitle forced to the copy below so the homepage
//     reads consistently regardless of each category's admin description.

export default apiInitializer("1.8.0", (api) => {
  const NAV_ID = "gn-topnav";
  const HERO_ID = "gn-hero";

  // Real category slug -> card label + subtitle.
  //   general / governance      kept as-is
  //   knowledge-base            shown as "Onboarding"
  //   announcements             shown as "Updates"
  // If a slug differs on your install, change the key here, the
  // `category_slugs` setting, and the matching .gn-cat-<slug> rule in the SCSS.
  const CARDS = {
    general: {
      label: "General",
      sub: "General discussion on technical and community topics.",
    },
    governance: {
      label: "Governance",
      sub: "Open governance: every member can propose, debate, and vote GIPs.",
    },
    "knowledge-base": {
      label: "Onboarding",
      sub: "New to GnosisDAO? Start here.",
    },
    announcements: {
      label: "Updates",
      sub: "Official announcements and the latest from across the DAO.",
    },
  };

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const labelFor = (slug) =>
    (CARDS[slug] && CARDS[slug].label) ||
    slug.split("-").map(cap).join(" ");

  function ensureTopNav() {
    if (document.getElementById(NAV_ID)) {
      return;
    }
    const header =
      document.querySelector(".d-header-wrap") ||
      document.querySelector("header.d-header");
    if (!header) {
      return;
    }

    // `type: list` settings reach JS as a pipe-delimited string in most
    // Discourse versions (some expose an array). Handle both.
    const raw = settings.category_slugs;
    const slugs = (Array.isArray(raw) ? raw : String(raw || "").split("|"))
      .map((s) => s.trim())
      .filter(Boolean);
    const bar = document.createElement("nav");
    bar.id = NAV_ID;
    bar.className = "gn-topnav";

    let html = '<div class="gn-topnav-inner">';
    slugs.forEach((slug) => {
      html += `<a class="gn-topnav-link" href="/c/${slug}">${labelFor(
        slug
      )}</a>`;
    });
    if (settings.dao_tracker_url) {
      html += `<a class="gn-topnav-link gn-topnav-ext" href="${settings.dao_tracker_url}" target="_blank" rel="noopener">DAO Tracker ↗</a>`;
    }
    html += "</div>";
    bar.innerHTML = html;

    header.insertAdjacentElement("afterend", bar);
  }

  function syncActiveNav() {
    const path = window.location.pathname;
    document.querySelectorAll(".gn-topnav-link").forEach((a) => {
      const href = a.getAttribute("href") || "";
      a.classList.toggle(
        "active",
        href.startsWith("/c/") && path.startsWith(href)
      );
    });
  }

  function ensureHero(isHome) {
    const existing = document.getElementById(HERO_ID);
    if (!isHome || !settings.show_hero) {
      if (existing) {
        existing.remove();
      }
      return;
    }
    if (existing) {
      return;
    }
    const mount = document.querySelector("#main-outlet");
    if (!mount) {
      return;
    }
    const hero = document.createElement("section");
    hero.id = HERO_ID;
    hero.className = "gn-hero";
    hero.innerHTML = `<h1>${settings.hero_heading || ""}</h1><p>${
      settings.hero_subheading || ""
    }</p>`;
    mount.insertAdjacentElement("afterbegin", hero);
  }

  function decorateBoxes() {
    document
      .querySelectorAll(
        ".category-list .category-box, .custom-category-boxes .category-box, .category-list-item"
      )
      .forEach((box) => {
        const link = box.matches('a[href*="/c/"]')
          ? box
          : box.querySelector('a[href*="/c/"]');
        if (!link) {
          return;
        }
        const m = (link.getAttribute("href") || "").match(/\/c\/([^/?#]+)/);
        if (!m) {
          return;
        }
        const slug = m[1];
        if (!box.classList.contains(`gn-cat-${slug}`)) {
          box.classList.add(`gn-cat-${slug}`);
        }

        const cfg = CARDS[slug];
        if (!cfg) {
          return;
        }

        // Force the card title (preserve the link, swap only the visible name).
        const heading = box.querySelector(".category-box-heading");
        if (heading) {
          const nameEl =
            heading.querySelector(".badge-category__name") ||
            heading.querySelector("a") ||
            heading;
          if (nameEl.textContent.trim() !== cfg.label) {
            nameEl.textContent = cfg.label;
          }
        }

        // Force the card subtitle.
        const desc = box.querySelector(
          ".description, .category-box-description"
        );
        if (desc && desc.textContent.trim() !== cfg.sub) {
          desc.textContent = cfg.sub;
        }
      });
  }

  api.onPageChange(() => {
    // defer one frame so the route has rendered
    window.requestAnimationFrame(() => {
      ensureTopNav();
      syncActiveNav();
      decorateBoxes();

      const router = api.container.lookup("service:router");
      const route = router && router.currentRouteName;
      const isHome = !!route && route.startsWith("discovery.categories");
      ensureHero(isHome);
    });
  });
});
