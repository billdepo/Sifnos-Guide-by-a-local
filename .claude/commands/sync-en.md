---
description: Translate the latest changes in content/el.json (source of truth) into content/en.json
---

Update `content/en.json` so it mirrors `content/el.json`. Greek is the source of truth — never edit el.json in this task; only en.json changes.

## Steps

1. Find what changed in the Greek content since the English file was last updated:
   ```
   git diff $(git log -1 --format=%H -- content/en.json) -- content/el.json
   ```
   If that diff is empty or unhelpful (e.g. both files changed in the same commits), run the structural check instead and use its output as the worklist:
   ```
   node scripts/check-content-sync.mjs
   ```
   Note: the structural check cannot detect Greek *text edits* to existing entries — if the git diff shows rewritten descriptions/tips, those must be retranslated even when the structure already matches.

2. Apply the corresponding changes to `content/en.json`, translating Greek → English. Items must appear in the SAME subsection and SAME order as in el.json (including moves between subsections).

## Translation rules

- **Translate**: `name`, `description`, `intro`, `label`, `tips`, `note`, `notes` in nearbyLinks, `meta`, `tags`, `title`, `highlight`, `aka`, `mustTry`, `nearbyLabel`, `windTip`, chapter `body` text.
- **Never change**: `id`, `lat`, `lng`, `mapsUrl`, `url`, `month`, `day`, `endDay`, `rating`, `icon`, `access` values (`car`/`hike`/`boat`/`walking` are keys, not display text), `heroImageUrl`, calendar `year`, embedded HTML attributes (`class`, `data-target` in card-link anchors — translate only the link's visible text).
- **`contacts` arrays** (info & booking blocks on cards): translate `note`; keep `phone` and `url` exactly as-is; `name` is usually a business name written in Latin script — keep it, and only transliterate if it's written in Greek (e.g. «Το Πηλοτεχνείο» → "To Pilotechnio").
- **`embed` objects** (inline iframes, e.g. bus/events): translate `label` and `note` (note may contain an `<a>` link — translate only its visible text); keep `url` exactly as-is.
- **`download` objects** (download buttons): translate `label`; keep `url` exactly as-is.
- **`weather` object** (`ui.weather`): translate `title`, `toggleLabel`, `beaufort`, `hintLabel`, `hint*`, `loading`, `error`, `source`, and each entry of the `directions` array (compass names); leave numeric/technical values alone.
- **New sections/subsections**: if el.json gains a whole new section (e.g. `villages`) or a new tab, mirror the entire structure into en.json in the same position, translating all display text. Remember to add the matching `nav` entry.
- **Never copy from el.json**: `meta.lang` stays `"en"`; `ui.languageToggle` stays `"ΕΛ"` (the button shows the OTHER language); `ui.calendar.monthsShort`/`weekdays` stay English.
- **Place names**: use the transliterations already established in en.json (Platy Gialos, Vathi, Kamares, Kastro, Apollonia, Artemonas, Faros, Cherronisos, Chrysopigi...). Check existing usage before inventing a new spelling.
- **Tone**: match the existing English — a warm, first-person local's guide. Idiomatic English over literal translation (e.g. «δεν θα πληρώσεις τον κούκο αηδόνι» → "you won't pay an arm and a leg"). Keep it concise.

## Validate

3. `node scripts/check-content-sync.mjs` must print OK, and both files must parse as JSON.
4. Finish with a short summary of what was translated, added, moved, or removed.
