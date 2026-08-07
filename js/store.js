/**
 * Content loading, normalisation and the search index.
 *
 * The JSON keeps one shape per section (subsections / areas / restaurants /
 * chapters …). Everything downstream — router, list view, search, map — reads
 * the *normalised* model built here instead, so there is exactly one place
 * that knows about the JSON's irregularities.
 */

const STORAGE_KEY = "sifnos-guide-lang";
export const DEFAULT_LANG = "el";

export const state = {
  lang: localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG,
  raw: null, // untouched JSON
  ui: null,
  meta: null,
  views: {}, // id → normalised view
  order: [], // view ids, in nav order
  byId: new Map(), // item id → { item, viewId, groupId }
  index: [], // flat search index
};

export function setLang(lang) {
  state.lang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
}

export async function loadContent(lang) {
  // no-cache: always revalidate so content edits show up without a hard refresh
  const res = await fetch(`content/${lang}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Cannot load content/${lang}.json`);
  const raw = await res.json();
  normalise(raw);
  return raw;
}

/** Emoji per section — used by the home tiles and the tab bar. */
export const VIEW_ICONS = {
  beaches: "🏖️",
  villages: "🏘️",
  drinks: "🍹",
  food: "🍴",
  activities: "⛵",
  culture: "🎭",
  history: "📜",
  practical: "🧭",
  map: "🗺️",
};

/**
 * Groups whose items are short prose with no rating, phone or map link.
 * Hiding those behind a tap would cost more than it saves, so they render
 * expanded in the list instead of as tappable rows.
 */
const NOTE_GROUPS = new Set(["localFood", "localProducts"]);

function group(id, label, items, extra = {}) {
  return {
    id,
    label: label || null,
    intro: extra.intro || null,
    embed: extra.embed || null,
    items: items || [],
    display: NOTE_GROUPS.has(id) ? "notes" : "rows",
  };
}

function normalise(raw) {
  const s = raw.sections;
  const views = {};

  views.beaches = {
    id: "beaches",
    kind: "list",
    label: s.beaches.label,
    intro: s.beaches.intro,
    groups: s.beaches.subsections.map((sub) =>
      group(sub.id, sub.label, sub.items, sub),
    ),
  };

  views.villages = {
    id: "villages",
    kind: "list",
    label: s.villages.label,
    intro: s.villages.intro,
    groups: [group("all", null, s.villages.items)],
  };

  views.drinks = {
    id: "drinks",
    kind: "list",
    label: s.drinks.label,
    intro: s.drinks.intro,
    groups: s.drinks.areas.map((a) => group(a.id, a.areaName, a.items, a)),
  };

  views.food = {
    id: "food",
    kind: "list",
    label: s.food.label,
    intro: s.food.intro,
    groups: ["restaurants", "localFood", "bakeries", "localProducts"]
      .filter((k) => s.food[k])
      .map((k) => group(k, s.food[k].label, s.food[k].items, s.food[k])),
  };

  views.activities = {
    id: "activities",
    kind: "list",
    label: s.activities.label,
    intro: s.activities.intro,
    groups: s.activities.subsections.map((sub) =>
      group(sub.id, sub.label, sub.items, sub),
    ),
  };

  views.culture = {
    id: "culture",
    kind: "list",
    label: s.culture.label,
    intro: s.culture.intro,
    groups: s.culture.subsections.map((sub) =>
      group(sub.id, sub.label, sub.items, sub),
    ),
  };

  views.history = {
    id: "history",
    kind: "timeline",
    label: s.history.label,
    intro: s.history.intro,
    groups: [group("all", null, s.history.chapters)],
  };

  views.practical = {
    id: "practical",
    kind: "tips",
    label: s.practical.label,
    intro: s.practical.intro,
    groups: [group("all", null, s.practical.items)],
  };

  state.raw = raw;
  state.ui = raw.ui;
  state.meta = raw.meta;
  state.views = views;
  // nav order minus the synthetic home/map entries the shell adds itself
  state.order = Object.keys(raw.nav).filter((k) => views[k]);

  buildIndexes();
}

function buildIndexes() {
  state.byId = new Map();
  state.index = [];

  for (const viewId of state.order) {
    const view = state.views[viewId];
    for (const g of view.groups) {
      for (const item of g.items) {
        if (!item.id) continue;
        const entry = { item, viewId, groupId: g.id, view, group: g };
        state.byId.set(item.id, entry);
        state.index.push({
          ...entry,
          name: item.name || item.title || "",
          keys: searchKeys(item, view, g),
        });
      }
    }
  }
}

/* ─── Text normalisation for search ──────────────────────────────
   Greek needs three things a naive `includes()` misses: accents
   (Μπάνιο vs μπανιο), final sigma (Καμάρες vs καμαρες), and visitors
   who type Latin ("vathi", "platis gialos"). */

const GREEK_TO_LATIN = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

export function fold(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents, Greek and Latin alike
    .toLowerCase()
    .replace(/ς/g, "σ");
}

/**
 * A loose Latin key for Greek place names.
 *
 * Transliteration has no single right answer — Βαθύ is written Vathi, Vathy
 * and Vathee; Χερρόνησος is Cherronisos or Herronissos — so both the index and
 * the query are collapsed onto the same lossy key rather than compared
 * letter for letter.
 */
export function latinise(str) {
  return fold(str)
    .replace(/[α-ω]/g, (c) => GREEK_TO_LATIN[c] || c)
    .replace(/h/g, "") // th→t, ch→c, ph→p
    .replace(/c/g, "k") // kastro / castro
    .replace(/y/g, "i") // vathy / vathi
    .replace(/w/g, "o")
    .replace(/b/g, "v") // mpar / bar
    .replace(/(.)\1+/g, "$1"); // rr → r
}

function searchKeys(item, view, g) {
  const name = item.name || item.title || "";
  const body = [
    item.aka,
    item.description,
    item.body,
    item.note,
    item.tips,
    item.meta,
    item.location,
    item.parentArea,
    item.locationDetail,
    view.label,
    g.label,
    ...(item.tags || []),
    ...(item.mustTry || []),
    ...(item.contacts || []).map((c) => c.name),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    name: fold(name),
    nameLat: latinise(name),
    body: fold(body),
    bodyLat: latinise(body),
  };
}

/**
 * Rank matches: a name hit always beats a body hit, and a prefix hit beats a
 * mid-word one — so "vath" puts Βαθύ above the tavernas that mention it.
 */
export function search(query, limit = 40) {
  const q = fold(query).trim();
  if (q.length < 2) return [];
  const qLat = latinise(query).trim();
  const terms = q.split(/\s+/);
  const termsLat = qLat.split(/\s+/);

  const hits = [];
  for (const entry of state.index) {
    let score = 0;
    let matchedAll = true;

    for (let i = 0; i < terms.length; i++) {
      const t = terms[i];
      const tl = termsLat[i];
      const k = entry.keys;
      let best = 0;

      if (k.name.startsWith(t) || k.nameLat.startsWith(tl)) best = 100;
      else if (k.name.includes(t) || k.nameLat.includes(tl)) best = 60;
      else if (k.body.includes(t) || k.bodyLat.includes(tl)) best = 20;

      if (!best) {
        matchedAll = false;
        break;
      }
      score += best;
    }

    if (matchedAll) {
      if (entry.item.rating === 3) score += 8; // nudge the good stuff up
      if (entry.item.rating === 0) score -= 8;
      hits.push({ ...entry, score });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ─── Derived collections ──────────────────────────────────────── */

/** Beaches marked as sheltered from the given compass letter ("N"). */
export function shelteredFrom(letter) {
  return state.index.filter(
    (e) => e.viewId === "beaches" && (e.item.shelteredFrom || []).includes(letter),
  );
}

/** Everything with coordinates — the payload for the full map view. */
export function mappable() {
  return state.index.filter((e) => e.item.lat && e.item.lng);
}

/**
 * The next dated festival on or after today, plus whether it is today.
 * Falls back to the first of next season once the last one has passed.
 */
export function nextEvent(now = new Date()) {
  const dated = state.index.filter((e) => e.item.month && e.item.day);
  if (!dated.length) return null;

  const key = (m, d) => m * 100 + d;
  const today = key(now.getMonth() + 1, now.getDate());

  const sorted = [...dated].sort(
    (a, b) =>
      key(a.item.month, a.item.day) - key(b.item.month, b.item.day),
  );
  const upcoming = sorted.find((e) => {
    const last = e.item.endDay || e.item.day;
    return key(e.item.month, last) >= today;
  });
  const entry = upcoming || sorted[0];
  const isToday =
    key(entry.item.month, entry.item.day) <= today &&
    key(entry.item.month, entry.item.endDay || entry.item.day) >= today;

  return { ...entry, isToday };
}

/** "{n} αποτελέσματα" → "12 αποτελέσματα" */
export function t(str, vars = {}) {
  return String(str || "").replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? vars[k] : `{${k}}`,
  );
}
