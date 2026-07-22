# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Discourse **theme** (not a component) for the GnosisDAO forum (forum.gnosis.io), named `May_2026_update_v2` in `about.json`. It is a fork of `May_2026_update`, installed as a separate theme record so admins can A/B the two. Verified against Discourse 3.5.2. There is no build step, linter, or test suite — Discourse compiles the SCSS/JS itself when the theme is installed.

## Deploying / testing changes

Package the theme as a tar.gz (run from this directory's parent):

```
tar --exclude .DS_Store --exclude .github --exclude .git --exclude old_versions -zcvf may-2026-update-v2.tar.gz may-2026-update-v2
```

Then install/update it via the Discourse admin panel (`Customize > Theme > Install`). There is no local dev server in this repo; changes are verified against the live forum.

## Architecture

Standard Discourse theme layout:

- `about.json` — theme name, color schemes (`Gnosis Dark`, `gc-dark`), SVG asset registration (asset keys become SCSS vars: `$general`, `$governance`, `$onboarding`, `$updates`), and the bundled components (category-group-boxes, search-banner, clickable-topic).
- `common/common.scss` — base dark-palette overrides (pins Discourse's derived `--primary-*` scale to neutral greys, fixes `--d-hover`/`--d-selected` contrast) and imports the files in `scss/`.
- `scss/gnosis-forum-dark.scss` — the main redesign layer (page glow, top nav bar styling, category tiles). Imported **last** so it wins on equal specificity.
- `desktop/desktop.scss`, `mobile/mobile.scss` — per-platform layers. Mobile has its own layout quirks (no search banner on the mobile homepage; the theme injects a JS mobile intro instead).
- `javascripts/discourse/api-initializers/gnosis-forum-dark.js` — the single large DOM-enhancement initializer: injects the top quick-links nav, optional hero, homepage category cards' labels/subtitles, sidebar rows, and the Knowledge Base "Support" handling. Written deliberately defensively (null checks, fallbacks) to survive Discourse version changes — keep that style.
- `common/header.html` — server-rendered, crawler-visible SEO intro (hidden in the app via CSS scoped to `body:not(.crawler)`).
- `settings.yml` — theme settings (hero toggle/copy, `dao_tracker_url`, `category_slugs` order).

### Category identity: three coordinated maps

The surfaced homepage categories (currently general, dao, knowledge-base) are defined in **three places that must stay in sync**, all keyed by the category's REAL slug:

1. `CARDS` map in `gnosis-forum-dark.js` — label, card subtitle, fallback category id.
2. `$gn-categories` map in `scss/gnosis-forum-dark.scss` — brand colour + illustration asset. All colour cues (card tile, sidebar square, category-header square, topic-list bullet) are generated from this map; never hand-write per-slug colour rules.
3. `category_slugs` setting in `settings.yml` — display order.

Adding/removing/renaming a slug also requires updating the "show only the canonical cards" `:not()` chain in `scss/gnosis-forum-dark.scss`.

### Slug gotchas

- The Governance category's real slug is `dao` (shown as "Governance").
- `announcements` (formerly shown as "Updates") is deliberately scrubbed from the front end: it is in `HIDDEN_SLUGS` in the JS (filtered out of cards, sidebar row removed) with a CSS fallback hide rule in `scss/gnosis-forum-dark.scss`. Don't re-add it to the maps without removing it from `HIDDEN_SLUGS`.
- `Support` is a real subcategory of `knowledge-base`; the JS routes KB parent views to the `/none` filter and injects a Support pill.

### Required Discourse admin settings

The theme assumes: `fixed_category_positions` on, desktop category page style `categories and latest topics`, category style `bullet`, and a specific top-menu / category ordering — see README.md. Brand fonts (Unica77LL) are uploaded manually via the theme's Uploads section, not bundled.
