// Structural comparison of content/el.json (source of truth) vs content/en.json.
// Text values are expected to differ (different languages); this checks that
// every object key and array entry exists in both files.
// Usage: node scripts/check-content-sync.mjs
import { readFileSync } from "fs";

const el = JSON.parse(readFileSync("content/el.json", "utf8"));
const en = JSON.parse(readFileSync("content/en.json", "utf8"));

const issues = [];

function label(node) {
  if (node && typeof node === "object" && !Array.isArray(node)) {
    return node.id || node.name || node.title || "";
  }
  return "";
}

function walk(a, b, path) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      issues.push(`${path}: array in el, ${typeof b} in en`);
      return;
    }
    if (a.length !== b.length) {
      issues.push(
        `${path}: ${a.length} entries in el vs ${b.length} in en` +
          (label(a[Math.min(a.length, b.length)])
            ? ` (first unmatched: "${label(a[Math.min(a.length, b.length)])}")`
            : ""),
      );
    }
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const tag = label(a[i]) ? `[${i} "${label(a[i])}"]` : `[${i}]`;
      walk(a[i], b[i], `${path}${tag}`);
    }
  } else if (a && typeof a === "object") {
    if (!b || typeof b !== "object" || Array.isArray(b)) {
      issues.push(`${path}: object in el, missing/mismatched in en`);
      return;
    }
    for (const k of Object.keys(a)) {
      if (!(k in b)) {
        issues.push(`${path}.${k}: missing in en`);
        continue;
      }
      walk(a[k], b[k], `${path}.${k}`);
    }
    for (const k of Object.keys(b)) {
      if (!(k in a)) issues.push(`${path}.${k}: extra in en (not in el)`);
    }
  }
}

walk(el, en, "$");

if (issues.length) {
  console.log(`STRUCTURE MISMATCHES (${issues.length}):`);
  issues.forEach((i) => console.log(" - " + i));
  process.exitCode = 1;
} else {
  console.log("OK: el.json and en.json structures match.");
}
