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
index.html          ← structural shell only (nav containers, section anchors)
                       no hardcoded text except the HTML lang attribute

css/
  style.css         ← all visual styles, uses CSS custom properties for theming

js/
  app.js            ← fetches active language JSON → renders all content into DOM
                       handles language toggle, localStorage persistence, smooth scroll

content/
  el.json           ← Greek content (source of truth — edit this first)
  en.json           ← English content (translated from el.json)

images/
  hero.jpg          ← main hero image (or use a CDN URL)
  (optional per-location photos)
```

**Data flow:**
1. Page loads → `app.js` reads `localStorage.get('lang')` (default: `'el'`)
2. Fetches `content/{lang}.json`
3. Renders all sections into the DOM
4. Language toggle button → flips lang, saves to localStorage, re-renders

All UI strings (section labels, tag names, nav items, button text) live inside the JSON files — **nothing is hardcoded in HTML** beyond structural containers.

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
├── index.html              ← structural shell
├── PLAN.md                 ← this file
├── css/
│   └── style.css
├── js/
│   └── app.js
├── content/
│   ├── el.json             ← Greek content (source of truth)
│   └── en.json             ← English content
└── images/
    └── hero.jpg            ← (or reference a CDN URL in the JSON)
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

## 9. Out of Scope for v1

- Embedded Google Maps iframes (link-out to Maps is sufficient)
- Photo gallery per location
- Filter by rating ("show only ★★★")
- Comments or user-contributed tips
- PWA / offline support
- Print stylesheet
