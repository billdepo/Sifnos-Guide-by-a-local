#!/usr/bin/env node
/**
 * Download the guide's place photos from Wikimedia Commons and write the
 * attribution each licence requires into el.json / en.json.
 *
 * Everything here is CC-licensed or public domain and is stored locally under
 * images/places/ — hotlinking Commons is both discouraged and fragile.
 *
 * To add a photo: find a file on commons.wikimedia.org, add
 * "<item-id>": "<exact File name>" to PHOTOS below, and re-run:
 *
 *   node scripts/fetch-photos.mjs
 *
 * Already-downloaded files are skipped, so re-running is cheap.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "images", "places");
const WIDTH = 1400;

/** item id → Commons file name (without the "File:" prefix). */
const PHOTOS = {
  // Villages
  apollonia: "Apollonia on Sifnos.jpg",
  artemonas: "Artemonas.jpg",
  kastro: "Kastro, Sifnos.jpg",
  "kamares-2": "View of Kamares, Sifnos from Hill.jpg",
  faros: "Faros Sifnos Cyclades.jpg",
  "platy-gialos-2": "Platis Gialos, Sifnos.jpg",
  vathi: "Vathy harbour Greek island of Sifnos.jpg",
  "cherronisos-2": "Herronisos.JPG",

  // Beaches
  kamares: "Beach of Kamares, Sifnos at Noon.jpg",
  "platy-gialos": "Cyclades Sifnos Platis Gialos 09092014 - panoramio.jpg",
  vathu: "Beach in Vathy on Sifnos, 153617.jpg",
  "chrysopigi-apokopto":
    "Cyclades Sifnos Panagia Chrisopigi Vue Apokofto Plage 09092014 - panoramio.jpg",
  fasolou: "Cyclades Sifnos Fasolou Vue Chryssopigi - panoramio.jpg",
  cherronisos: "Cyclades Sifnos Keronisos Plage - panoramio.jpg",
  fykiada: "Fykiada Bay and Kitriani island.JPG",

  // Churches & monasteries
  "panagia-chrysopigi-2": "Panagia Chrysopigi on the Greek Island of Sifnos.jpg",
  "profitis-ilias-monastery": "Profitis Ilias Sifnos.JPG",
};

/**
 * Photos from anywhere other than Commons: item id → { url, credit, creditUrl }.
 *
 * ⚠️ These carry NO open licence. Everything in PHOTOS above is CC or public
 * domain and safe to republish; anything here is used at the site owner's own
 * risk and needs the rights holder's permission. Credit alone is not a licence.
 * Prefer a Commons file, or the owner's own photo, whenever one exists.
 */
const EXTRA = {
  glyfo: {
    url: "https://cycladesmap.gr/wp-content/uploads/2024/07/Glyfo-Beach-Sifnos-35.jpg",
    credit: "cycladesmap.gr",
    creditUrl: "https://cycladesmap.gr/",
    // permission: not yet requested
  },
};

const API = "https://commons.wikimedia.org/w/api.php";
// Wikimedia blocks generic agents — their policy wants a contact address.
const UA = "sifnos-guide/1.0 (https://github.com/billdepo/Sifnos-Guide-by-a-local)";
const strip = (html) =>
  String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function metadata(titles) {
  const url =
    `${API}?action=query&format=json&prop=imageinfo` +
    `&iiprop=url|extmetadata&iiurlwidth=${WIDTH}` +
    `&titles=${titles.map((t) => encodeURIComponent("File:" + t)).join("|")}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const json = await res.json();

  const out = new Map();
  for (const page of Object.values(json.query?.pages || {})) {
    const ii = page.imageinfo?.[0];
    if (!ii) continue;
    const m = ii.extmetadata || {};
    out.set(page.title.replace(/^File:/, ""), {
      url: ii.thumburl || ii.url,
      page: ii.descriptionurl,
      author: strip(m.Artist?.value) || "Unknown",
      license: strip(m.LicenseShortName?.value) || "see source",
    });
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Commons rate-limits bursts (429), so back off and retry rather than fail. */
async function download(url, dest, attempt = 1) {
  const clean = url.split("?")[0]; // drop Commons' utm_* tracking params
  const res = await fetch(clean, { headers: { "User-Agent": UA } });
  if (res.status === 429 && attempt <= 6) {
    const wait = 4000 * attempt;
    console.log(`  … rate-limited, retrying in ${wait / 1000}s`);
    await sleep(wait);
    return download(url, dest, attempt + 1);
  }
  if (!res.ok) throw new Error(`download ${res.status} ${clean}`);
  writeFileSync(dest, await optimise(Buffer.from(await res.arrayBuffer())));
}

/**
 * Commons originals run to ~800 KB each, which is indefensible on a phone.
 * Resize to 1200px / q76 when sharp is available (`npm i sharp`); otherwise
 * save as-is and say so, rather than silently shipping 10 MB of photos.
 */
let sharp;
let warnedNoSharp = false;
async function optimise(buf) {
  if (sharp === undefined) sharp = (await import("sharp").catch(() => null))?.default || null;
  if (!sharp) {
    if (!warnedNoSharp) {
      console.warn("  ! sharp not installed — photos saved unoptimised (npm i sharp)");
      warnedNoSharp = true;
    }
    return buf;
  }
  return sharp(buf)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 76, mozjpeg: true })
    .toBuffer();
}

/** Walk every item list in the JSON and hand each item to `fn`. */
function eachItem(doc, fn) {
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (node.id && (node.name || node.title)) fn(node);
    Object.values(node).forEach(walk);
  };
  walk(doc.sections);
}

const ids = Object.keys(PHOTOS);
const meta = await metadata(Object.values(PHOTOS));
mkdirSync(outDir, { recursive: true });

const images = {};
let downloaded = 0;
const failures = [];

for (const id of ids) {
  const file = PHOTOS[id];
  const info = meta.get(file);
  if (!info) {
    console.warn(`  ! no metadata for "${file}" (${id}) — skipped`);
    continue;
  }
  const name = `${id}.jpg`;
  const dest = join(outDir, name);
  if (!existsSync(dest)) {
    try {
      await download(info.url, dest);
      downloaded++;
      console.log(`  ↓ ${name}`);
    } catch (err) {
      // One unavailable photo must not abandon the whole run — re-running
      // picks up where this left off, because existing files are skipped.
      console.warn(`  ! ${name}: ${err.message}`);
      failures.push(id);
      continue;
    }
    await sleep(2500); // be a polite Commons client
  }
  images[id] = {
    src: `images/places/${name}`,
    credit: `${info.author} (${info.license}, Wikimedia Commons)`,
    creditUrl: info.page,
  };
}

for (const [id, info] of Object.entries(EXTRA)) {
  const name = `${id}.jpg`;
  const dest = join(outDir, name);
  if (!existsSync(dest)) {
    try {
      await download(info.url, dest);
      downloaded++;
      console.log(`  ↓ ${name} (non-Commons — check permission)`);
    } catch (err) {
      console.warn(`  ! ${name}: ${err.message}`);
      failures.push(id);
      continue;
    }
  }
  images[id] = {
    src: `images/places/${name}`,
    credit: info.credit,
    creditUrl: info.creditUrl,
  };
}

for (const lang of ["el", "en"]) {
  const path = join(root, "content", `${lang}.json`);
  const doc = JSON.parse(readFileSync(path, "utf8"));
  let applied = 0;
  eachItem(doc, (item) => {
    if (images[item.id]) {
      item.image = images[item.id];
      applied++;
    }
  });
  writeFileSync(path, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`${lang}.json: ${applied} image(s) attached`);
}

console.log(`Done. ${downloaded} new file(s) downloaded, ${Object.keys(images).length} mapped.`);
if (failures.length) {
  console.warn(`Missing (re-run to retry): ${failures.join(", ")}`);
  process.exitCode = 1;
}
