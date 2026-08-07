#!/usr/bin/env node
/**
 * Give every content item a stable, language-independent `id`.
 *
 * Ids are the backbone of the URL router (#/beaches/sandy/vroulidia) and of
 * the search index, so they must be identical in el.json and en.json. They are
 * slugified from the ENGLISH name — Greek slugs would percent-encode into
 * unreadable URLs — and written into both files at the same position.
 *
 * Existing ids are never changed (old links keep working). Run after adding
 * new content:  node scripts/assign-ids.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const paths = {
  el: join(root, "content", "el.json"),
  en: join(root, "content", "en.json"),
};

const el = JSON.parse(readFileSync(paths.el, "utf8"));
const en = JSON.parse(readFileSync(paths.en, "utf8"));

// Greek → Latin, for the rare item that has no distinct English name
const GREEK = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

function slugify(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (Greek + Latin)
    .toLowerCase()
    .replace(/[α-ως]/g, (c) => GREEK[c] || c)
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * The item lists, as [elArray, enArray] pairs. Kept explicit rather than
 * discovered so a shape change in the JSON fails loudly here.
 */
function collect(elRoot, enRoot) {
  const pairs = [];
  const push = (a, b, label) => {
    if (!a || !b) return;
    if (a.length !== b.length) {
      throw new Error(`Length mismatch at ${label}: el=${a.length} en=${b.length}`);
    }
    pairs.push([a, b, label]);
  };

  const s = elRoot.sections;
  const t = enRoot.sections;

  s.beaches.subsections.forEach((sub, i) =>
    push(sub.items, t.beaches.subsections[i].items, `beaches/${sub.id}`),
  );
  push(s.villages.items, t.villages.items, "villages");
  s.drinks.areas.forEach((a, i) =>
    push(a.items, t.drinks.areas[i].items, `drinks/${a.id}`),
  );
  for (const key of ["restaurants", "localFood", "bakeries", "localProducts"]) {
    push(s.food[key]?.items, t.food[key]?.items, `food/${key}`);
  }
  s.activities.subsections.forEach((sub, i) =>
    push(sub.items, t.activities.subsections[i].items, `activities/${sub.id}`),
  );
  s.culture.subsections.forEach((sub, i) =>
    push(sub.items, t.culture.subsections[i].items, `culture/${sub.id}`),
  );
  push(s.history.chapters, t.history.chapters, "history");
  push(s.practical.items, t.practical.items, "practical");

  return pairs;
}

const used = new Set();
let added = 0;

// Reserve ids that already exist so generated ones can't collide with them
for (const [elArr] of collect(el, en)) {
  for (const item of elArr) if (item.id) used.add(item.id);
}

function unique(base) {
  let id = base || "item";
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

for (const [elArr, enArr, label] of collect(el, en)) {
  elArr.forEach((elItem, i) => {
    const enItem = enArr[i];
    if (elItem.id) {
      enItem.id = elItem.id; // keep the mirror honest
      return;
    }
    const source = enItem.name || enItem.title || elItem.name || elItem.title;
    if (!source) throw new Error(`No name/title to slugify at ${label}[${i}]`);
    const id = unique(slugify(source));
    // `id` first, so it reads as the item's identity in the JSON
    const reorder = (obj) => {
      const copy = { id, ...obj };
      for (const k of Object.keys(obj)) delete obj[k];
      Object.assign(obj, copy);
    };
    reorder(elItem);
    reorder(enItem);
    added++;
  });
}

writeFileSync(paths.el, JSON.stringify(el, null, 2) + "\n", "utf8");
writeFileSync(paths.en, JSON.stringify(en, null, 2) + "\n", "utf8");
console.log(`Assigned ${added} new id(s). ${used.size} ids total.`);
