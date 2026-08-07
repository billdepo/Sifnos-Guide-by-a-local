# Sifnos Guide — Technical Plan

## 1. Overview & Goals

A static travel guide website for Sifnos island, Greece, written by a local. The site must:

- Separate **content** (data) from **presentation** (UI) so content can be updated without touching HTML/CSS
- Support **two languages** (Greek / English) via a language toggle
- Be **shareable** via a single URL (GitHub Pages)
- Be **mobile-friendly** and easy to read on the go
- Require **no build step** — push to GitHub → live immediately

---

## 2. Tech Stack Decision

| Layer | Choice | Reason |
|-------|--------|--------|
| Markup | HTML5 (single `index.html`) | No framework overhead; shell only, no hardcoded content |
| Styles | CSS3 (custom properties, grid, flexbox) | Full control, no dependency |
| Logic | Vanilla JavaScript (ES6+) | Content rendering + language switching; no framework needed for this scope |
| Content | JSON files (`content/el.json`, `content/en.json`) | Human-editable, directly consumable by JS, structured, diffable in git |
| Hosting | GitHub Pages (main branch, root) | Free, no CI needed, zero config |

**Why not a framework (React/Vue/Astro)?**  
The site is read-only content with a language toggle. A framework adds a build step, a `node_modules` folder, and maintenance burden for no real benefit at this scale.

**Why JSON over Markdown/YAML?**  
JSON is directly `fetch()`-able by JS without a parser. It enforces a schema (rating as integer, tags as array) which makes the UI logic clean and predictable. Markdown would require a parser and loses structure.

---

## 3. Architecture: Content–UI Separation

```
index.html          ← app shell only: app bar, empty #view, tab bar, sheet, drawer
                       no content text whatsoever

css/
  style.css         ← all visual styles, CSS custom properties for theming

js/                 ← ES modules, loaded natively (no bundler)
  app.js            ← boot, chrome (app bar / tab bar / drawer), route dispatch
  router.js         ← hash router: #/view/group/item?f=filters
  store.js          ← content load, normalisation, search index, collections
  views.js          ← one render function per screen
  ui.js             ← shared HTML fragments (rows, detail, badges, calendar)
  sheet.js          ← the detail bottom sheet
  map.js            ← Leaflet lifecycle
  weather.js        ← Open-Meteo fetch + rendering

content/
  el.json           ← Greek content (source of truth — edit this first)
  en.json           ← English content (translated from el.json)

images/
  hero.jpg          ← home hero
  places/           ← per-item photos from Wikimedia Commons (see §10)

scripts/
  assign-ids.mjs        ← gives every item a stable, language-independent id
  check-content-sync.mjs← asserts el/en structural parity
  fetch-photos.mjs      ← downloads + optimises Commons photos, writes credits
```

**Data flow:**
1. Page loads → `store.js` reads `localStorage.get('lang')` (default `'el'`) and fetches `content/{lang}.json`
2. `normalise()` flattens the JSON's five different section shapes into one `views → groups → items` model, and builds the search index and the `id → item` map
3. `router.start()` parses the hash and calls `onRoute()`
4. `onRoute()` renders **exactly one view** into `#view`, then opens the detail sheet if the URL names an item
5. Language toggle → re-fetch, re-normalise, re-render the current route

Only one view is in the DOM at a time. That is what keeps a 120-item guide to
two or three screens of scrolling on a phone instead of twenty.

All UI strings live inside the JSON files — **nothing is hardcoded in HTML**
beyond structural containers.

### Navigation model

Every piece of navigable state is in the URL, so any screen is linkable and the
hardware back button always does the obvious thing.

| URL | Screen |
|-----|--------|
| `#/` | Home hub: weather, next festival, collections, section tiles |
| `#/beaches` | Section, first group |
| `#/beaches/pebble` | Section + group |
| `#/beaches/pebble/vroulidia` | …with that item's sheet open over it |
| `#/beaches/sandy?f=must,a-car` | …filtered to must-visit + reachable by car |
| `#/search?q=vathi` | Search |
| `#/map` / `#/map/glyfo` | Full-screen map, optionally focused |
| `#/collection/must` | Derived collection (every ★★★ in the guide) |

Opening an item does **not** re-render the list underneath, so its scroll
position survives. Closing the sheet pops history when the sheet was opened
from that list, and replaces it when the user arrived by deep link.

---

## 4. Content Schema

Both `el.json` and `en.json` follow this schema exactly, so the renderer needs no language-specific logic.

### Top Level

```json
{
  "meta": {
    "title": "Σίφνος",
    "subtitle": "Ο Οδηγός ενός Ντόπιου",
    "description": "...",
    "lang": "el"
  },
  "nav": {
    "beaches": "Μπάνιο",
    "drinks": "Ποτό",
    "food": "Φαγητό",
    "tips": "Συμβουλές"
  },
  "ui": {
    "languageToggle": "EN",
    "mustVisit": "Must visit",
    "recommended": "Συνιστάται",
    "worthAVisit": "Αξίζει",
    "notRecommended": "Δεν προτείνεται",
    "mapsLink": "Google Maps",
    "mustTryLabel": "Δοκίμασε:",
    "tagsLabel": ""
  },
  "sections": { ... }
}
```

### Rating Scale

Replaces the PDF's `✔` / `✔✔` / `✔✔✔` / `❌` system with an integer 0–3:

| Integer | UI Display | Label |
|---------|-----------|-------|
| `0` | ✗ (grey badge) | Not recommended |
| `1` | ★☆☆ | Worth a visit |
| `2` | ★★☆ | Recommended |
| `3` | ★★★ | Must visit |

The renderer reads the integer and fills/unfills stars accordingly. This is cleaner than emoji strings.

### Beaches Section

```json
"beaches": {
  "label": "Μπάνιο",
  "intro": "...",
  "windTip": "Όταν έχει μπουφώρ βοριά, πηγαίνετε προς Φάρο, Βαθύ ή Πλατύ Γιαλό.",
  "subsections": [
    {
      "id": "sandy",
      "label": "Αμμώδεις Παραλίες",
      "items": [
        {
          "id": "glyfo",
          "name": "Γλυφό",
          "parentArea": "Φάρος",
          "rating": 3,
          "access": "car",
          "tags": ["sandy", "youth-friendly", "turquoise"],
          "description": "...",
          "tips": "...",
          "mapsUrl": "https://goo.gl/maps/..."
        }
      ]
    },
    {
      "id": "pebble",
      "label": "Παραλίες με Βότσαλα",
      "items": [ ... ]
    },
    {
      "id": "rocky",
      "label": "Βραχώδεις Ακτές",
      "items": [ ... ]
    }
  ]
}
```

### Drinks Section

```json
"drinks": {
  "label": "Ποτό",
  "intro": "...",
  "items": [
    {
      "id": "cavo-sunrise",
      "name": "Cavo Sunrise",
      "aka": "Κουβανός",
      "location": "Κάστρο",
      "rating": 3,
      "tags": ["sunset", "cocktails", "laid-back"],
      "description": "...",
      "mustTry": ["Ρούμι Ανανά", "Mojito", "Ρούμι Cola"]
    }
  ]
}
```

### Food Section

Split into two subsections:

```json
"food": {
  "label": "Φαγητό",
  "restaurants": {
    "label": "Εστιατόρια & Ταβέρνες",
    "items": [
      {
        "id": "kelari",
        "name": "Το Κελάρι",
        "location": "Κάτω Πετάλι",
        "locationDetail": "δίπλα στην Απολλωνία",
        "rating": 3,
        "tags": ["traditional", "local-recipes"],
        "description": "..."
      }
    ]
  },
  "localFood": {
    "label": "Παραδοσιακά Φαγητά & Προϊόντα",
    "intro": "Η Σίφνος είναι η γενέτειρα του Τσελεμεντέ...",
    "items": [
      {
        "id": "mastelo",
        "name": "Μαστέλο",
        "description": "...",
        "tags": ["meat", "clay-pot", "slow-cooked"]
      }
    ]
  },
  "bakeries": {
    "label": "Αρτοποιεία & Γλυκά",
    "items": [ ... ]
  }
}
```

### Tips Section

```json
"tips": {
  "label": "Συμβουλές",
  "items": [
    {
      "id": "wind",
      "title": "Καιρός & Άνεμος",
      "description": "...",
      "icon": "wind"
    },
    {
      "id": "ceramics",
      "title": "Κεραμικά",
      "description": "...",
      "icon": "gift"
    }
  ]
}
```

---

## 5. i18n Approach

- **Two parallel JSON files** — `el.json` (edit here) and `en.json` (translated)
- The schema is **identical** in both files — the renderer is language-agnostic
- `app.js` fetches the correct file and rebuilds the DOM on language switch
- Language saved in `localStorage` key `'sifnos-guide-lang'`
- The `<html lang="...">` attribute is updated dynamically
- **No third-party i18n library** — the JSON structure itself is the translation layer

**Workflow for content updates:**
1. Edit `content/el.json` (source of truth)
2. Run `/sync-en` in Claude Code → translates the changes into `content/en.json` and validates structural parity (`node scripts/check-content-sync.mjs`)
3. `git push` → live in ~30 seconds

---

## 6. Design System

### Color Palette
Inspired by the Cycladic landscape:

```css
--color-primary:    #1A4F7A;  /* Aegean deep blue */
--color-accent:     #C0623B;  /* Terracotta / Cycladic sun */
--color-bg:         #F7F5F0;  /* Warm off-white (island walls) */
--color-surface:    #FFFFFF;
--color-text:       #2C3440;
--color-text-muted: #6B7280;
--color-border:     #E5E0D8;
--color-star-fill:  #E8A030;  /* Rating stars */
--color-star-empty: #D5CFC6;
```

### Typography
Both fonts from Google Fonts (loaded in `<head>`):

| Use | Font | Weight |
|-----|------|--------|
| Display / Hero | `Playfair Display` | 700 |
| Section headings | `Playfair Display` | 600 |
| Body text | `Inter` | 400 |
| Labels / tags | `Inter` | 500 |
| UI buttons | `Inter` | 600 |

### Components

| Component | Description |
|-----------|-------------|
| `Hero` | Full-viewport-height banner with island photo, title, subtitle, language toggle |
| `StickyNav` | Horizontal pill-nav that sticks on scroll; active section highlighted |
| `SectionHeader` | Section title + intro text + optional tip banner |
| `SubsectionHeader` | Groups cards (e.g., "Sandy", "Rocky shores") |
| `LocationCard` | Name, rating stars, location badge, tags (chips), description, expandable tips, optional map link |
| `FoodCard` | Simplified card for traditional foods — name, description, tags (no rating) |
| `RestaurantCard` | Like LocationCard but with location badge |
| `TipCard` | Icon + title + description for general tips |
| `RatingStars` | 3 stars filled/empty based on 0–3 integer |
| `TagChip` | Small rounded label (access type, vibe, food type) |
| `LanguageToggle` | Button in hero and sticky nav, switches el ↔ en |

### Layout
- Mobile-first, single column
- `display: grid` with `auto-fill, minmax(320px, 1fr)` for card grids on tablet+
- Max content width: `1100px`, centered
- Sections separated by `80px` vertical spacing
- Cards have `border-radius: 12px`, subtle `box-shadow`

---

## 7. File Structure (Final)

```
/
├── index.html              ← app shell
├── PLAN.md                 ← this file
├── REFERENCES.md           ← every source used for the content
├── css/
│   └── style.css
├── js/                     ← ES modules (see §3)
│   ├── app.js  router.js  store.js  views.js
│   └── ui.js   sheet.js   map.js    weather.js
├── content/
│   ├── el.json             ← Greek content (source of truth)
│   └── en.json             ← English content
├── scripts/
│   ├── assign-ids.mjs
│   ├── check-content-sync.mjs
│   └── fetch-photos.mjs
└── images/
    ├── hero.jpg
    ├── sifnos-bus-schedule.jpg
    └── places/             ← 17 Commons photos, ~2 MB total
```

---

## 8. Deployment

**GitHub Pages — zero config:**
1. Push repo to GitHub (public or private with Pages enabled)
2. Repo Settings → Pages → Source: `main` branch, `/ (root)`
3. Site live at `https://<username>.github.io/Sifnos-Guide-by-a-local/`

**Important:** Because `app.js` uses `fetch()` to load JSON, the site **must be served over HTTP** (not opened as a local file). For local development, use any simple static server:
```bash
npx serve .
# or
python -m http.server 8000
```

---

## 9. Still Out of Scope

- Comments or user-contributed tips
- PWA / offline support (a service worker would suit an on-island guide well —
  the obvious next step)
- Print stylesheet
- Geolocation ("what's near me") — needs coordinates on more than the 17
  items that have them today
- Hand-curated itineraries ("one day on Sifnos", "a day with kids"). The
  derived collections cover the computable cases; a real itinerary is
  editorial content that has to be written, not generated.

Delivered since v1: per-location photos, filter by rating and access mode,
full-text search, deep links, a full-screen map, and the detail sheet.

---

## 10. Photos

Photos come from **Wikimedia Commons** and are stored locally under
`images/places/` — hotlinking Commons is discouraged and fragile.

```bash
npm i sharp                  # optional, but do it: 10.3 MB → 2.1 MB
node scripts/fetch-photos.mjs
```

The script downloads each file, resizes to 1200 px / q76, and writes an
`image: { src, credit, creditUrl }` block into both JSON files. The credit is
rendered under the photo in the detail sheet, which is what the CC BY / CC BY-SA
licences require — **do not strip it**.

To add a photo: find the file on commons.wikimedia.org, add
`"<item-id>": "<exact File name>"` to `PHOTOS` in the script, re-run. Existing
downloads are skipped, so re-running is cheap.

Wikimedia rejects generic user agents; the script identifies itself with a
contact URL, which is a requirement of their bot policy rather than a nicety.
