import { apiInitializer } from "discourse/lib/api";

// Gnosis Forum Dark — DOM enhancements
// Kept deliberately defensive so it survives Discourse version changes.
//   - top category bar: inserted after the site header
//   - hero: prepended to #main-outlet (off by default; the search banner
//     already serves as the homepage welcome)
//   - category boxes: tagged with gn-cat-<slug> so the SCSS can paint each
//     tile's illustration. Targets both the native .category-list markup and
//     the .custom-category-boxes markup rendered by the
//     discourse-category-group-boxes component this theme uses.

export default apiInitializer("1.8.0", (api) => {
  const NAV_ID = "gn-topnav";
  const HERO_ID = "gn-hero";

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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
      const label = slug
        .split("-")
        .map(cap)
        .join(" ");
      html += `<a class="gn-topnav-link" href="/c/${slug}">${label}</a>`;
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

  function tagBoxes() {
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
        if (m && !box.classList.contains(`gn-cat-${m[1]}`)) {
          box.classList.add(`gn-cat-${m[1]}`);
        }
      });
  }

  api.onPageChange(() => {
    // defer one frame so the route has rendered
    window.requestAnimationFrame(() => {
      ensureTopNav();
      syncActiveNav();
      tagBoxes();

      const router = api.container.lookup("service:router");
      const route = router && router.currentRouteName;
      const isHome = !!route && route.startsWith("discovery.categories");
      ensureHero(isHome);
    });
  });
});
