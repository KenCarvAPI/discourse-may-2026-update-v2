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
      sub: "Open governance: propose, debate and vote GIPs.",
    },
    "knowledge-base": {
      label: "Onboarding",
      sub: "New to GnosisDAO? Start here.",
    },
    announcements: {
      label: "Updates",
      sub: "The latest from across the DAO.",
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

    const bar = document.createElement("nav");
    bar.id = NAV_ID;
    bar.className = "gn-topnav";

    // External quick-links, left-aligned. DAO Tracker keeps its place on the
    // right (.gn-topnav-ext pushes it there via margin-left:auto). These were
    // previously a separate "community utility bar" above the category list.
    const extLink = (href, label, extraClass = "") =>
      `<a class="gn-topnav-link${extraClass ? " " + extraClass : ""}"` +
      ` href="${href}" target="_blank" rel="noopener noreferrer">` +
      `${label}<span class="gn-topnav-arrow" aria-hidden="true">↗</span></a>`;

    const links = [
      extLink("https://dao-docs.vercel.app", "Docs"),
      extLink("https://snapshot.org/#/gnosis.eth", "Snapshot"),
      extLink("https://gno.now", "Treasury"),
    ];
    if (settings.dao_tracker_url) {
      links.push(
        extLink(settings.dao_tracker_url, "DAO Tracker", "gn-topnav-ext")
      );
    }

    bar.innerHTML = `<div class="gn-topnav-inner">${links.join("")}</div>`;

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

  // Guarantee the four homepage cards exist. The boxes component renders the
  // Governance box empty (it is the only category with subcategories), leaving a
  // blank slot. After decorateBoxes has tagged the boxes that DID render, drop
  // any empty/contentless boxes and inject a proper card for any of the four
  // slugs that is still missing, in the configured order.
  function ensureCards() {
    const grid = document.querySelector(".custom-category-boxes");
    if (!grid) {
      return;
    }

    // Remove blank boxes (a glitchy parent box can render with no link/text).
    grid.querySelectorAll(".category-box").forEach((b) => {
      if (!b.querySelector('a[href*="/c/"]') && !b.textContent.trim()) {
        b.remove();
      }
    });

    const site = api.container.lookup("service:site");
    const categories = (site && site.categories) || [];
    const urlForSlug = (slug) => {
      const c = categories.find(
        (cat) => cat && cat.slug === slug && !cat.parent_category_id
      );
      return c ? c.url || `/c/${c.slug}/${c.id}` : `/c/${slug}`;
    };

    const raw = settings.category_slugs;
    const order = (Array.isArray(raw) ? raw : String(raw || "").split("|"))
      .map((s) => s.trim())
      .filter(Boolean);

    let prev = null;
    order.forEach((slug) => {
      let box = grid.querySelector(`.gn-cat-${slug}`);
      if (!box) {
        const cfg = CARDS[slug] || { label: labelFor(slug), sub: "" };
        box = document.createElement("span");
        box.className = `category-box gn-cat-${slug} gn-injected`;
        box.innerHTML = `<a href="${urlForSlug(
          slug
        )}"><div class="category-box-inner"><h3 class="category-box-heading">${
          cfg.label
        }</h3><p class="description">${cfg.sub}</p></div></a>`;
        if (prev) {
          prev.insertAdjacentElement("afterend", box);
        } else {
          grid.appendChild(box);
        }
      }
      prev = box;
    });
  }

  // The top-level Delegate Communication category. It is NOT a subcategory of
  // Governance, so the category-group-boxes component never renders a tile for
  // it on the Governance page — we inject one (see ensureDelegateTile). The id
  // is a fallback; the live category record is preferred when available.
  const DELEGATE = {
    slug: "delegate-communication",
    id: 33,
    name: "Delegate Communication",
    color: "00A6C4",
    sub: "Updates and coordination from Gnosis delegates.",
    logo: "/uploads/default/original/2X/a/a7735e46f625fa6694685b4a4d67d701743034fe.png",
  };

  // On the Governance category page (real slug `dao`, display name
  // "Governance") the category-group-boxes component renders the three
  // governance subcategories (GIPs, Closed Proposals, Governance Resources).
  // We surface ONLY Governance Resources, then inject a Delegate Communication
  // tile beside it; the SCSS hides every tile we don't tag with .gn-keep-box.
  // Matches on the subcategory slug (…/c/dao/<slug>…) with a heading-text
  // fallback, and accepts the legacy `governance` slug too, so a slug change
  // doesn't silently hide everything.
  function pruneGovernanceBoxes() {
    if (
      !document.body.classList.contains("category-dao") &&
      !document.body.classList.contains("category-governance")
    ) {
      return;
    }
    const grid = document.querySelector(".custom-category-boxes");
    if (!grid) {
      return;
    }

    let resourcesBox = null;
    grid.querySelectorAll(".category-box").forEach((box) => {
      if (box.classList.contains("gn-delegate-tile")) {
        return;
      }
      const link = box.matches('a[href*="/c/"]')
        ? box
        : box.querySelector('a[href*="/c/"]');
      const href = (link && link.getAttribute("href")) || "";
      const keep =
        /\/c\/(?:dao|governance)\/[^/?#]*resource/i.test(href) ||
        /governance\s*resource/i.test(box.textContent || "");
      box.classList.toggle("gn-keep-box", keep);
      if (keep) {
        resourcesBox = box;
      }
    });

    ensureDelegateTile(grid, resourcesBox);
  }

  // Clone the (native) Governance Resources tile so the injected Delegate
  // Communication tile inherits the component's exact markup and styling, then
  // re-point its link, name, logo, and category id. Tagged .gn-keep-box so the
  // SCSS reveals it; the marker class is intentionally NOT gn-cat-* so the
  // homepage "show only four cards" rule doesn't hide it.
  function ensureDelegateTile(grid, templateBox) {
    if (!templateBox || grid.querySelector(".gn-delegate-tile")) {
      return;
    }

    const site = api.container.lookup("service:site");
    const categories = (site && site.categories) || [];
    const cat = categories.find(
      (c) => c && c.slug === DELEGATE.slug && !c.parent_category_id
    );
    const url =
      (cat && (cat.url || `/c/${cat.slug}/${cat.id}`)) ||
      `/c/${DELEGATE.slug}/${DELEGATE.id}`;
    const logo =
      (cat && cat.uploaded_logo && cat.uploaded_logo.url) || DELEGATE.logo;
    const id = (cat && cat.id) || DELEGATE.id;
    const color = (cat && cat.color) || DELEGATE.color;

    const box = templateBox.cloneNode(true);
    box.className = box.className.replace(/\bcategory-box-\S+/g, "");
    box.classList.add(
      "category-box",
      `category-box-${DELEGATE.slug}`,
      "gn-delegate-tile",
      "gn-injected",
      "gn-keep-box"
    );

    // Re-point every link (the box is itself an <a>, plus the inner
    // .parent-box-link) and the component's click-routing data attributes.
    const retarget = (el) => {
      if (el.hasAttribute("href")) {
        el.setAttribute("href", url);
      }
      if (el.hasAttribute("data-url")) {
        el.setAttribute("data-url", url);
      }
      if (el.hasAttribute("data-category-id")) {
        el.setAttribute("data-category-id", id);
      }
    };
    retarget(box);
    box.querySelectorAll("[href], [data-url], [data-category-id]").forEach(
      retarget
    );

    // Swap the visible name (component markup: .category-box-heading > a > h3).
    const nameEl =
      box.querySelector(".category-box-heading h3") ||
      box.querySelector(".category-box-heading a") ||
      box.querySelector(".category-box-heading") ||
      box.querySelector("h3");
    if (nameEl) {
      nameEl.textContent = DELEGATE.name;
    }

    // Recolor the logo tile and swap its image to the Delegate logo.
    const logoEl = box.querySelector(".category-logo");
    if (logoEl) {
      logoEl.setAttribute("style", `background-color: #${color}`);
      logoEl.classList.remove("no-logo-present");
      const abbr = logoEl.querySelector(".category-abbreviation");
      if (abbr) {
        abbr.remove();
      }
    }
    let img = box.querySelector(".category-logo img") || box.querySelector("img");
    if (!img && logoEl) {
      img = document.createElement("img");
      logoEl.appendChild(img);
    }
    if (img) {
      img.setAttribute("src", logo);
      img.removeAttribute("srcset");
      img.setAttribute("alt", DELEGATE.name);
      img.setAttribute("width", "256");
      img.setAttribute("height", "256");
    }

    // Replace the carried-over Resources description with the Delegate copy.
    const descEl =
      box.querySelector(".description p") ||
      box.querySelector(".description") ||
      box.querySelector(".category-box-description");
    if (descEl) {
      descEl.textContent = DELEGATE.sub;
    }

    templateBox.insertAdjacentElement("afterend", box);
  }

  // Relabel the native left sidebar category links so they match the rest of
  // the theme (e.g. "Knowledge Base" -> "Onboarding"). Discourse renders the
  // real category name there; we swap only the visible text, keeping the link.
  function decorateSidebar() {
    document
      .querySelectorAll('.sidebar-section-link[href*="/c/"]')
      .forEach((link) => {
        const m = (link.getAttribute("href") || "").match(/\/c\/([^/?#]+)/);
        if (!m) {
          return;
        }
        const cfg = CARDS[m[1]];
        if (!cfg) {
          return;
        }
        const textEl =
          link.querySelector(".sidebar-section-link-content-text") || link;
        if (textEl.textContent.trim() !== cfg.label) {
          textEl.textContent = cfg.label;
        }
      });

    ensureSidebarUpdatesUnderOnboarding();
  }

  // Guarantee the "Updates" (announcements) link sits directly beneath
  // "Onboarding" (knowledge-base) in the left sidebar. If it is already in the
  // list but ordered elsewhere, move it; if it is missing entirely, build it by
  // cloning the Onboarding row so it inherits the native sidebar markup.
  function ensureSidebarUpdatesUnderOnboarding() {
    const wrapperFor = (slug) => {
      const link = document.querySelector(
        `.sidebar-section-link[href*="/c/${slug}"]`
      );
      return link ? link.closest(".sidebar-section-link-wrapper") || link : null;
    };

    const onboarding = wrapperFor("knowledge-base");
    if (!onboarding || !onboarding.parentNode) {
      return;
    }

    let updates = wrapperFor("announcements");

    if (updates) {
      // Already present — only move it if it is not already the next sibling.
      if (onboarding.nextElementSibling !== updates) {
        onboarding.parentNode.insertBefore(
          updates,
          onboarding.nextElementSibling
        );
      }
      return;
    }

    // Missing — resolve the announcements category URL and clone the row.
    // Canonical form is /c/<slug>/<id> (a bare /c/<slug> does not always
    // route), so prefer the live category record and fall back to the known id.
    const site = api.container.lookup("service:site");
    const categories = (site && site.categories) || [];
    const cat = categories.find(
      (c) => c && c.slug === "announcements" && !c.parent_category_id
    );
    const url = (cat && (cat.url || `/c/${cat.slug}/${cat.id}`)) ||
      "/c/announcements/34";
    // Swatch colour for the cloned Updates row. We use the homepage card's
    // blue (matching the Updates illustration) rather than the raw announcements
    // category colour; the SCSS enforces the same value with !important.
    const color = "#3a8cb8";

    updates = onboarding.cloneNode(true);
    // The clone carries Onboarding's category id, ember id and description
    // title; repoint every one of them at announcements so the link routes
    // there and reads correctly.
    if (updates.hasAttribute("data-category-id") && cat) {
      updates.setAttribute("data-category-id", String(cat.id));
    }
    const link = updates.querySelector(".sidebar-section-link") || updates;
    link.removeAttribute("id");
    link.setAttribute("href", url);
    link.setAttribute("title", (CARDS.announcements && CARDS.announcements.sub) || "");
    // Recolour the category swatch (prefix square) to the announcements colour.
    const prefix = link.querySelector(".sidebar-section-link-prefix");
    if (prefix) {
      prefix.style.color = color;
    }
    const square = link.querySelector(".prefix-square");
    if (square) {
      square.style.background = `linear-gradient(90deg, ${color} 50%, ${color} 50%)`;
    }
    link.classList.remove("active");
    link.removeAttribute("aria-current");
    const textEl =
      link.querySelector(".sidebar-section-link-content-text") || link;
    textEl.textContent = (CARDS.announcements && CARDS.announcements.label) ||
      "Updates";
    // Drop any unread/new count badge carried over from the cloned row.
    const badge = link.querySelector(".sidebar-section-link-content-badge");
    if (badge) {
      badge.remove();
    }

    onboarding.parentNode.insertBefore(updates, onboarding.nextElementSibling);
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
    if (h1 && h1.textContent.trim() !== "Welcome to the GnosisDAO Forum") {
      h1.textContent = "Welcome to the GnosisDAO Forum";
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
          p.textContent.trim() !== "Governance discussion for the Gnosis Ecosystem"
        ) {
          p.textContent = "Governance discussion for the Gnosis Ecosystem";
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
      decorateSidebar();
      decorateSearchBanner();
      pruneGovernanceBoxes();

      const router = api.container.lookup("service:router");
      const route = router && router.currentRouteName;
      const isHome = !!route && route.startsWith("discovery.categories");

      // Only decorate on the categories homepage. On a single category page
      // the boxes are subcategories whose URLs are /c/<parent>/<child>/<id>;
      // the slug regex would read the parent ("general") and mislabel every
      // subcategory as that parent category.
      if (isHome) {
        decorateBoxes();
        ensureCards();
      }
      ensureHero(isHome);
    });
  });
});
