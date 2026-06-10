import { apiInitializer } from "discourse/lib/api";
import DiscourseURL from "discourse/lib/url";

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
  // Knowledge Base "Support folder": Support is a real subcategory of Knowledge
  // Base (slug `support` under `knowledge-base`). The theme hides KB subcategory
  // tiles, and the parent KB list shows subcategory topics by default — so the
  // Support (and Archive) topics cluttered the main list with no way to reach
  // them on their own.
  //   FIX: route every KB parent-category view to Discourse's native /none
  //   filter (/c/knowledge-base/<id>/none[/l/<order>]), which excludes
  //   subcategory topics server-side — so the main list shows ONLY KB posts
  //   (see forceKbNoneFilter / rewriteKbParentLinks). Support is surfaced via an
  //   injected "Support" pill (ensureSupportTab) that opens its subcategory. The
  //   CSS row-prune (pruneSupportTopics) is now only a fallback for the instant
  //   before the redirect lands.
  // (Knowledge Base's own id lives in the CARDS config below; kbId() reads it
  // from the live record, falling back to that id. The Support subcategory id is
  // likewise a fallback; the live record is preferred when present.)
  const KB_SLUG = "knowledge-base";
  const SUPPORT_SLUG = "support";
  const SUPPORT_ID = 8;
  const SUPPORT_TAB_ID = "gn-support-tab";
  const SUPPORT_CARD_ID = "gn-support-card";

  // ---- Per-category config: SINGLE SOURCE OF TRUTH (JS side) ----------------
  // Everything the JS needs about a surfaced category, keyed by its REAL slug:
  //   label  visible name used on cards, sidebar, and category headers
  //   sub    homepage card subtitle
  //   id     fallback category id — used ONLY if the live category record can't
  //          be resolved at runtime (see categoryUrl). Keep it correct as a
  //          last-resort safety net; null where no fallback is needed.
  // Brand COLOURS are the SCSS counterpart — see the $gn-categories map in
  // scss/gnosis-forum-dark.scss. The two maps are keyed by the same slugs.
  //
  //   general          kept as-is
  //   dao              shown as "Governance" (its display name)
  //   knowledge-base   shown as "Knowledge Base" (its real name)
  //   announcements    shown as "Updates"
  // NOTE: the Governance category's real slug on this install is `dao` (/c/dao),
  // keyed here under `dao`, not `governance`. If a slug differs on your install,
  // change the key here, the `category_slugs` setting, and BOTH the
  // $gn-categories map and the "show only four" :not() chain in the SCSS.
  const CARDS = {
    general: {
      label: "General",
      sub: "General discussion on technical and community topics.",
      id: null,
    },
    dao: {
      label: "Governance",
      sub: "Open governance: propose, debate and vote GIPs.",
      id: 20,
    },
    "knowledge-base": {
      label: "Knowledge Base",
      sub: "New to GnosisDAO? Start here.",
      id: 32,
    },
    announcements: {
      label: "Updates",
      sub: "The latest from across the DAO.",
      id: 34,
    },
  };

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const labelFor = (slug) =>
    (CARDS[slug] && CARDS[slug].label) ||
    slug.split("-").map(cap).join(" ");

  // ----- Category resolution (shared) ----------------------------------------
  // One place that turns a slug into a live category record / canonical URL, so
  // every injected element (homepage cards, sidebar Updates row, Delegate tile,
  // Support pill) resolves the same way instead of re-implementing the lookup.

  function findCategory(pred) {
    const site = api.container.lookup("service:site");
    const categories = (site && site.categories) || [];
    return categories.find((c) => c && pred(c)) || null;
  }

  // Canonical URL for a top-level category. Prefers the live record; falls back
  // to the configured id (an explicit override, else CARDS[slug].id), then a
  // bare /c/<slug>. Canonical form is /c/<slug>/<id> because a bare /c/<slug>
  // does not always route.
  function categoryUrl(slug, fallbackId) {
    const cat = findCategory((c) => c.slug === slug && !c.parent_category_id);
    if (cat) {
      return cat.url || `/c/${cat.slug}/${cat.id}`;
    }
    const fid =
      fallbackId != null ? fallbackId : CARDS[slug] && CARDS[slug].id;
    return fid != null ? `/c/${slug}/${fid}` : `/c/${slug}`;
  }

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
      extLink("https://docs.gnosis.io/", "Docs"),
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

  // ----- Mobile homepage intro -----------------------------------------------
  // The discourse-search-banner (the desktop welcome/intro that frames "this is
  // the GnosisDAO governance forum") is not shown on the mobile categories
  // homepage, leaving phones with no intro copy at the top. Inject a compact
  // intro block on the homepage; the SCSS reveals it on mobile only (it stays
  // hidden on desktop, where the search banner already does this job). Skipped
  // when the search banner IS present so the two never stack.
  const MOBILE_INTRO_ID = "gn-mobile-intro";
  function ensureMobileIntro(isHome) {
    const existing = document.getElementById(MOBILE_INTRO_ID);
    const hasBanner = !!document.querySelector(".custom-search-banner-wrap");
    if (!isHome || hasBanner) {
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
    const intro = document.createElement("section");
    intro.id = MOBILE_INTRO_ID;
    intro.className = "gn-mobile-intro";
    intro.innerHTML =
      '<h1 class="gn-mobile-intro__title">GnosisDAO Governance Forum</h1>' +
      '<p class="gn-mobile-intro__sub">Governance discussion for the Gnosis ' +
      "ecosystem — propose, debate, and shape what comes next.</p>";
    mount.insertAdjacentElement("afterbegin", intro);
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
        box.innerHTML = `<a href="${categoryUrl(
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

    const cat = findCategory(
      (c) => c.slug === DELEGATE.slug && !c.parent_category_id
    );
    const url = categoryUrl(DELEGATE.slug, DELEGATE.id);
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

    // Missing — resolve the announcements category and clone the row. The URL
    // and id fall back to CARDS.announcements.id when the live record is absent
    // (see categoryUrl), so there is no loose hardcoded id here.
    const cat = findCategory(
      (c) => c.slug === "announcements" && !c.parent_category_id
    );
    const url = categoryUrl("announcements");
    const catId =
      (cat && cat.id) || (CARDS.announcements && CARDS.announcements.id);

    updates = onboarding.cloneNode(true);
    // The clone carries Onboarding's category id, ember id and description
    // title; repoint every one of them at announcements so the link routes
    // there and reads correctly.
    if (updates.hasAttribute("data-category-id") && catId != null) {
      updates.setAttribute("data-category-id", String(catId));
    }
    const link = updates.querySelector(".sidebar-section-link") || updates;
    link.removeAttribute("id");
    // The clone copies the `ember-view` class but NOT Ember's LinkTo click
    // listener, so clicks fall through to a hard browser navigation. Discourse's
    // global click interceptor (intercept-click.js) deliberately ignores any
    // <a class="ember-view"> that is not also a .d-link, so without this the
    // Updates link does a full page reload — which drops the ?preview_theme_id
    // param and bounces you back to the default (old) theme. Strip the stale
    // marker and add .d-link so the interceptor SPA-routes the click instead.
    link.classList.remove("ember-view");
    link.classList.add("d-link");
    link.setAttribute("href", url);
    link.setAttribute("title", (CARDS.announcements && CARDS.announcements.sub) || "");
    // The cloned row carries Onboarding's inline swatch colour; the SCSS
    // recolours it to the announcements swatch (keyed on the /c/announcements
    // href, applied with !important) so the colour lives in one place.
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

  // Relabel the category-page header so it matches the rest of the theme's
  // identity: on /c/knowledge-base the banner title reads "Knowledge Base", on
  // /c/announcements it reads "Updates" — the same labels used on the sidebar
  // and homepage cards. Discourse renders the real category name in the
  // .category-heading badge; we swap only the visible text (and keep the
  // screen-reader heading in sync). The swatch colour is applied in SCSS,
  // keyed on the body.category-<slug> class Discourse already sets.
  function decorateCategoryHeading() {
    const heading = document.querySelector(".category-heading");
    if (!heading) {
      return;
    }
    const slug = Object.keys(CARDS).find((s) =>
      document.body.classList.contains(`category-${s}`)
    );
    if (!slug) {
      return;
    }
    const cfg = CARDS[slug];

    // Visible title (modern badge markup, with older-class fallbacks).
    const nameEl =
      heading.querySelector(".badge-category__name") ||
      heading.querySelector(".category-title") ||
      heading.querySelector(".category-heading__badge");
    if (!nameEl) {
      return;
    }
    const realName = nameEl.textContent.trim();
    if (realName !== cfg.label) {
      nameEl.textContent = cfg.label;
    }

    // Keep the visually-hidden discovery heading (used by screen readers) in
    // sync by swapping the real name for the label where it appears.
    const srHeading = document.getElementById("topic-list-heading");
    if (srHeading && realName && srHeading.textContent.includes(realName)) {
      srHeading.textContent = srHeading.textContent.replace(realName, cfg.label);
    }
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
        'Idea? <a href="/new-topic?category=dao">Start a new topic to share it.</a>';
      wrap.appendChild(cta);
    }
  }

  // ----- Knowledge Base "Support folder" -------------------------------------
  // Surface the Support subcategory under an injected "Support" pill and prune
  // its topics from the parent KB list. The Support subcategory page itself is
  // never pruned (it IS the folder). Category lookup uses the shared
  // findCategory / categoryUrl helpers defined near the top.

  function kbId() {
    const cat = findCategory((c) => c.slug === KB_SLUG && !c.parent_category_id);
    return (cat && cat.id) || (CARDS[KB_SLUG] && CARDS[KB_SLUG].id);
  }

  // The Support subcategory record (slug `support`, parent = Knowledge Base).
  function supportCat() {
    const parent = String(kbId());
    return findCategory(
      (c) =>
        c.slug === SUPPORT_SLUG && String(c.parent_category_id) === parent
    );
  }

  function supportCatId() {
    const cat = supportCat();
    return (cat && cat.id) || SUPPORT_ID;
  }

  function supportUrl() {
    return `/c/${KB_SLUG}/${SUPPORT_SLUG}/${supportCatId()}`;
  }

  function onKbCategory() {
    return document.body.classList.contains("category-knowledge-base");
  }

  // ----- Force the KB main list to exclude subcategory topics -----------------
  // Knowledge Base lists its subcategory (Support, Archive) topics in the parent
  // list by default. Discourse has a NATIVE filter for "this category only" —
  // the `/none` suffix on the category route (/c/<slug>/<id>/none[/l/<order>]),
  // which the server honours for pagination, search and counts. We route every
  // KB parent-category view to that /none variant so the main list shows ONLY
  // Knowledge Base posts; Support/Archive are reached via their own links. This
  // is the real fix — the CSS row-prune below is just a fallback for the brief
  // moment before the redirect lands.

  // Canonical KB list URL with subcategories excluded. `listPart` is an optional
  // trailing list segment such as "/l/top".
  function kbNoneUrl(listPart = "") {
    return `/c/${KB_SLUG}/${kbId()}/none${listPart}`;
  }

  // Match the KB PARENT category route only (…/c/knowledge-base/<id>…), NOT the
  // Support/Archive subcategories (…/c/knowledge-base/support/…). Returns the
  // RegExp match (group 1 = existing none|all filter, group 2 = /l/<order>), or
  // null when the current path is not the KB parent list.
  function kbParentRouteMatch() {
    const id = kbId();
    if (id == null) {
      return null;
    }
    const path = window.location.pathname.replace(/\/+$/, "");
    return path.match(
      new RegExp(`^/c/${KB_SLUG}/${id}(?:/(none|all))?((?:/l/[^/?#]+)?)$`)
    );
  }

  // Route the KB parent list to its /none variant. Runs first on every page
  // change; returns true if it triggered a redirect (so the rest of the pass can
  // be skipped — onPageChange fires again on the new URL).
  function forceKbNoneFilter() {
    const m = kbParentRouteMatch();
    if (!m || m[1]) {
      // Not the KB parent list, or already /none (or an explicit /all).
      return false;
    }
    const target = kbNoneUrl(m[2] || "");
    if (DiscourseURL && typeof DiscourseURL.routeTo === "function") {
      DiscourseURL.routeTo(target);
    } else {
      window.location.replace(target);
    }
    return true;
  }

  // Repoint any link to the KB parent category at the /none variant, so clicking
  // the sidebar row / homepage card / nav pills lands on the filtered list
  // directly (no redirect flash). Subcategory links (…/support/…, …/archive/…)
  // are left untouched.
  function rewriteKbParentLinks(root) {
    const id = kbId();
    if (id == null) {
      return;
    }
    const re = new RegExp(
      `^/c/${KB_SLUG}/${id}(?:/(none|all))?((?:/l/[^/?#]+)?)/?(?:[?#]|$)`
    );
    (root || document)
      .querySelectorAll(`a[href*="/c/${KB_SLUG}/"]`)
      .forEach((a) => {
        const href = a.getAttribute("href") || "";
        const m = href.match(re);
        if (!m || m[1]) {
          return; // not the KB parent, or already filtered
        }
        a.setAttribute("href", kbNoneUrl(m[2] || ""));
      });
  }

  // True on the Support subcategory page (/c/knowledge-base/support/...).
  function onSupportView() {
    return new RegExp(`/c/${KB_SLUG}/${SUPPORT_SLUG}(?:[/?#]|$)`).test(
      window.location.pathname
    );
  }

  // A topic row belongs to Support if its category badge links to the Support
  // subcategory (or carries its category id).
  function rowInSupport(row, id) {
    return !!row.querySelector(
      `[data-category-id="${id}"], a[href*="/c/${KB_SLUG}/${SUPPORT_SLUG}/"]`
    );
  }

  // Hide Support-subcategory rows on the main KB topic list (Latest/Top/etc.).
  // Skipped on the Support page, where those topics are the whole point.
  function pruneSupportTopics() {
    if (!onKbCategory() || onSupportView()) {
      return;
    }
    const id = String(supportCatId());
    document.querySelectorAll(".topic-list-item").forEach((row) => {
      row.classList.toggle("gn-support-topic", rowInSupport(row, id));
    });
  }

  // Inject a "Support" pill into the category nav that opens the Support
  // subcategory. Cloned from a native pill so it inherits the theme's nav
  // styling; re-added on each page change (Ember re-renders the list) and marked
  // active while on the Support page.
  function ensureSupportTab() {
    if (!onKbCategory() && !onSupportView()) {
      return;
    }
    const pills = document.querySelector(
      ".list-controls .nav-pills, .navigation-container .nav-pills, ul.nav-pills"
    );
    if (!pills) {
      return;
    }

    let li = document.getElementById(SUPPORT_TAB_ID);
    if (!li) {
      const template =
        pills.querySelector("li:not(.navigation-toggle)") ||
        pills.querySelector("li");
      if (!template) {
        return;
      }
      li = template.cloneNode(true);
      li.id = SUPPORT_TAB_ID;
      const a = li.querySelector("a") || li;
      a.removeAttribute("id");
      a.removeAttribute("aria-current");
      a.classList.remove("active");
      a.setAttribute("title", "Knowledge Base support topics");
      // Drop any icon/badge carried over from the cloned pill; leave plain text.
      a.textContent = "Support";
      pills.appendChild(li);
    }

    const a = li.querySelector("a") || li;
    a.setAttribute("href", supportUrl());
    a.classList.toggle("active", onSupportView());
  }

  // Inject a "Support" subcategory card at the top of the KB post list (below
  // the category header / nav, above the topic list). Clicking it opens the
  // Support subcategory, where the support topics live. Not shown on the Support
  // page itself. The card lives inside the route-rendered content area, so it is
  // cleared automatically on navigation; the id guard prevents duplicates.
  function ensureSupportCard() {
    if (!onKbCategory() || onSupportView()) {
      return;
    }
    if (document.getElementById(SUPPORT_CARD_ID)) {
      return;
    }

    // Anchor: directly before the topic list, else the first child of the
    // discovery contents container.
    const list = document.querySelector(".topic-list");
    const contents = document.querySelector(
      ".list-container .contents, #main-outlet .contents"
    );
    let anchor, position;
    if (list) {
      anchor = list;
      position = "beforebegin";
    } else if (contents) {
      anchor = contents;
      position = "afterbegin";
    } else {
      return;
    }

    const card = document.createElement("a");
    card.id = SUPPORT_CARD_ID;
    card.className = "gn-support-card";
    card.setAttribute("href", supportUrl());
    card.innerHTML =
      '<span class="gn-support-card__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"></circle>' +
      '<circle cx="12" cy="12" r="3.5"></circle>' +
      '<line x1="4.9" y1="4.9" x2="9.5" y2="9.5"></line>' +
      '<line x1="14.5" y1="14.5" x2="19.1" y2="19.1"></line>' +
      '<line x1="19.1" y1="4.9" x2="14.5" y2="9.5"></line>' +
      '<line x1="9.5" y1="14.5" x2="4.9" y2="19.1"></line>' +
      "</svg></span>" +
      '<span class="gn-support-card__text">' +
      '<span class="gn-support-card__title">Support</span>' +
      '<span class="gn-support-card__sub">' +
      "Need help? Browse the GnosisDAO support channel." +
      "</span></span>" +
      '<span class="gn-support-card__arrow" aria-hidden="true">→</span>';

    anchor.insertAdjacentElement(position, card);
  }

  api.onPageChange(() => {
    // Force the KB main list to its /none (subcategories-excluded) variant
    // before anything renders. If this redirects, bail — onPageChange fires
    // again on the new URL and the work below runs there.
    if (forceKbNoneFilter()) {
      return;
    }

    // defer one frame so the route has rendered
    window.requestAnimationFrame(() => {
      ensureTopNav();
      syncActiveNav();
      decorateSidebar();
      decorateCategoryHeading();
      decorateSearchBanner();
      pruneGovernanceBoxes();
      ensureSupportTab();
      ensureSupportCard();
      pruneSupportTopics();

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
      ensureMobileIntro(isHome);

      // Run last so it also catches links inside freshly-injected homepage
      // cards / nav pills / the Support tab: repoint every KB parent-category
      // link at the /none (subcategories-excluded) variant.
      rewriteKbParentLinks();
    });
  });
});
