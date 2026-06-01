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

    // Resolve each slug to its real category URL (which includes the id).
    // A bare /c/<slug> link does not always route, which is why the Governance
    // link did not navigate; /c/<slug>/<id> is the canonical, reliable form.
    const site = api.container.lookup("service:site");
    const categories = (site && site.categories) || [];
    const urlForSlug = (slug) => {
      const c = categories.find(
        (cat) => cat && cat.slug === slug && !cat.parent_category_id
      );
      return c ? c.url || `/c/${c.slug}/${c.id}` : `/c/${slug}`;
    };

    const bar = document.createElement("nav");
    bar.id = NAV_ID;
    bar.className = "gn-topnav";

    let html = '<div class="gn-topnav-inner">';
    slugs.forEach((slug) => {
      html += `<a class="gn-topnav-link" data-gn-slug="${slug}" href="${urlForSlug(
        slug
      )}">${labelFor(slug)}</a>`;
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
      const slug = a.getAttribute("data-gn-slug");
      a.classList.toggle(
        "active",
        !!slug && path.startsWith(`/c/${slug}`)
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

  // Force the search-banner opener copy and add a "start a topic" CTA under the
  // search box. The headline/subhead can also be set natively in the
  // discourse-search-banner component settings; this keeps the copy in the
  // theme so it stays consistent.
  function decorateSearchBanner() {
    const wrap = document.querySelector(".custom-search-banner-wrap");
    if (!wrap) {
      return;
    }

    const h1 = wrap.querySelector("h1");
    if (h1 && h1.textContent.trim() !== "Welcome to Gnosis") {
      h1.textContent = "Welcome to Gnosis";
    }

    // First text paragraph becomes the subhead; hide any others (e.g. the old
    // "Join the conversation here" line).
    let first = true;
    wrap.querySelectorAll("p").forEach((p) => {
      if (p.closest(".search-menu, .search-widget, .results")) {
        return;
      }
      if (first) {
        if (
          p.textContent.trim() !== "Governance forum for the Gnosis Ecosystem"
        ) {
          p.textContent = "Governance forum for the Gnosis Ecosystem";
        }
        first = false;
      } else {
        p.style.display = "none";
      }
    });

    if (!wrap.querySelector(".gn-banner-cta")) {
      const cta = document.createElement("p");
      cta.className = "gn-banner-cta";
      cta.innerHTML =
        'Idea? <a href="/new-topic?category=governance">Start a new topic to share it.</a>';
      wrap.appendChild(cta);
    }
  }

  api.onPageChange(() => {
    // defer one frame so the route has rendered
    window.requestAnimationFrame(() => {
      ensureTopNav();
      syncActiveNav();
      decorateSearchBanner();

      const router = api.container.lookup("service:router");
      const route = router && router.currentRouteName;
      const isHome = !!route && route.startsWith("discovery.categories");

      // Only decorate on the categories homepage. On a single category page
      // the boxes are subcategories whose URLs are /c/<parent>/<child>/<id>;
      // the slug regex would read the parent ("general") and mislabel every
      // subcategory as that parent category.
      if (isHome) {
        decorateBoxes();
      }
      ensureHero(isHome);
    });
  });
});
