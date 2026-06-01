# May_2026_update_v2 Discourse Theme

Fork of `May_2026_update`, carrying the same dark-brand refresh of the [GnosisDAO Forum](https://forum.gnosis.io/) plus two fixes verified against Discourse 3.5.2: full (non-truncated) category-card subtitles, and a Glimmer-compatible rewrite of the `edit-category` body-class initializer. Installed as a separate theme so admins can A/B it against `May_2026_update` without disturbing either original.

## Installation

Create a tar.gz package of the fork (run from this `may-2026-update-v2` directory's parent):

```
tar --exclude .DS_Store --exclude .github --exclude .git --exclude old_versions -zcvf may-2026-update-v2.tar.gz may-2026-update-v2
```

In your Discourse administration panel, go to `Customize > Theme > Install`, choose the package and click install. Because the `name` in `about.json` (`May_2026_update_v2`) differs from the existing themes, Discourse will create a **new** theme record instead of overwriting any of them.

You can then enable it as default, set it as the dark-mode color scheme, or let users opt in.

## Components

- https://github.com/jordanvidrine/discourse-category-group-boxes
- https://github.com/discourse/discourse-search-banner
- https://github.com/discourse/discourse-clickable-topic


## Setup

In the admin panel go to the settings page and set the following properties.

### Fixed category positions (fixed_category_positions) 

Must be turned on (URL `/admin/site_settings/category/all_results?filter=fixed_category_positions`).


### Desktop category page style

Must be set to `categories and latest topics` (URL `/admin/site_settings/category/basic?filter=category`).

### Category style

Must be set to `bullet`.

### Top menu

Must be set to the following:
- categories
- latest
- top
- unread
- new


### Categories

For Gnosis DAO forum only, go to /categories click on tools and then on "Reorder categories":

- General 0
- Governance 1
- Treasury 2
- Knowledge Base 3
- Delegate communication 4
- Announcements 5
- Staff 6
- Internall staff 7
- Uncategorized 8

### Fonts

Licensed fonts are manually uploaded.
Ensure that you have the appropriate font files in either `.ttf`, `.otf`, or `.woff` format.

**Upload the Fonts to Discourse:**

 - Log in to your Discourse instance as an admin.
 - Navigate to the **Admin** section by clicking on your avatar and selecting "Admin."
 - Go to **Customize** > **Themes**. Choose the theme you wish to modify.
 - Go to the **Uploads** section and upload your font files by **+ Add** button.



### Dark mode

Operating systems and browsers might enforce the dark mode automatically.

In order for Discourse to pick up a color palette of your choice for the dark mode, go to `settings > Basic Setup > default dark mode color scheme ID` and choose the right value for it.


## Resources
- [Beginner's guide to using Discourse Themes](https://meta.discourse.org/t/beginners-guide-to-using-discourse-themes/91966)
- [Developer's guide to Discourse Themes](https://meta.discourse.org/t/developer-s-guide-to-discourse-themes/93648)
