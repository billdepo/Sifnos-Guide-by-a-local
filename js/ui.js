/**
 * Shared HTML fragments.
 *
 * Every string that reaches innerHTML comes from our own content JSON, which
 * intentionally contains a little markup (cross-card links), so values are
 * interpolated as-is rather than escaped.
 */

import { state, t } from "./store.js";

/** Medal metaphor, shared by list rows, map markers, legend and popups. */
export const RATING_COLORS = {
  3: "#D6A400", // gold — must visit
  2: "#9AA6B2", // silver — recommended
  1: "#C17A3C", // bronze — worth a visit
  0: "#6B7280", // slate — skip
};

export function coloredStars(rating, size = "") {
  const color = RATING_COLORS[rating] || "#888";
  if (rating === 0) return `<span class="stars ${size}" style="color:${color}">✗</span>`;
  return `<span class="stars ${size}" style="color:${color}">${"★".repeat(rating)}<span class="stars-empty">${"★".repeat(3 - rating)}</span></span>`;
}

export function ratingBlock(rating, labels) {
  if (rating === undefined || rating === null) return "";
  return `<span class="rating">${coloredStars(rating)}<span class="rating-label">${labels[String(rating)]}</span></span>`;
}

export function tags(arr) {
  if (!arr || !arr.length) return "";
  return `<div class="tags">${arr.map((x) => `<span class="tag">${x}</span>`).join("")}</div>`;
}

export function accessBadges(arr, labels) {
  if (!arr || !arr.length) return "";
  return arr
    .map((a) => `<span class="badge badge--${a}">${labels[a] || a}</span>`)
    .join("");
}

export function telHref(phone) {
  const digits = String(phone).replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+30${digits}`;
}

export function contacts(list, label) {
  if (!list || !list.length) return "";
  const rows = list
    .map((c) => {
      const name = c.url
        ? `<a class="contact-name" href="${c.url}" target="_blank" rel="noopener noreferrer">${c.name}<span class="ext">↗</span></a>`
        : `<span class="contact-name">${c.name}</span>`;
      const note = c.note ? `<span class="contact-note">${c.note}</span>` : "";
      const phone = c.phone
        ? `<a class="contact-phone" href="tel:${telHref(c.phone)}">📞 ${c.phone}</a>`
        : "";
      return `<li class="contact-row">${name}${note}${phone}</li>`;
    })
    .join("");
  return `<div class="detail-block"><h3 class="detail-block-title">ℹ️ ${label}</h3><ul class="contact-list">${rows}</ul></div>`;
}

export function nearby(links, label) {
  if (!links || !links.length) return "";
  const items = links
    .map(
      (l) => `<li class="nearby-item">
        ${l.icon ? `<span class="nearby-icon">${l.icon}</span>` : ""}
        <a class="nearby-link" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.name}<span class="ext">↗</span></a>${l.note ? ` <span class="nearby-note">— ${l.note}</span>` : ""}
      </li>`,
    )
    .join("");
  return `<div class="nearby"><span class="nearby-label">📍 ${label || "Κοντά"}</span><ul class="nearby-list">${items}</ul></div>`;
}

export function embed(e) {
  if (!e || !e.url) return "";
  return `<details class="card-embed">
      <summary>${e.label}</summary>
      <div class="embed-frame"><iframe data-src="${e.url}" loading="lazy" title="${e.label}"></iframe></div>
      ${e.note ? `<p class="embed-note">${e.note}</p>` : ""}
    </details>`;
}

export function download(dl) {
  if (!dl || !dl.url) return "";
  return `<a class="download-btn" href="${dl.url}" download aria-label="${dl.label}" title="${dl.label}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  </a>`;
}

/**
 * The photo itself, or an emoji stand-in. Deliberately anchor-free: rows wrap
 * their whole contents in an <a>, and a nested <a> makes the HTML parser close
 * the outer one early, which silently destroys the row's layout.
 */
export function media(item, icon) {
  if (item.image && item.image.src) {
    return `<img class="media-img" src="${item.image.src}" alt="${item.name || ""}" loading="lazy" decoding="async" />`;
  }
  return `<span class="media-icon" aria-hidden="true">${icon || "📍"}</span>`;
}

/** The attribution CC BY / CC BY-SA require. Detail view only — it has links. */
export function mediaCredit(item) {
  if (!item.image || !item.image.credit) return "";
  const text = item.image.creditUrl
    ? `<a href="${item.image.creditUrl}" target="_blank" rel="noopener noreferrer">${item.image.credit}</a>`
    : item.image.credit;
  return `<span class="media-credit">${state.ui.photoCredit}: ${text}</span>`;
}

/* ─── List rows ──────────────────────────────────────────────── */

/** One line of context under the name: area, date, access, location. */
function metaLine(item, ui) {
  const bits = [];
  // Something still listed but not running this season
  if (item.inactive) bits.push(`<span class="badge badge--inactive">${ui.inactiveLabel}</span>`);
  if (item.parentArea) bits.push(`<span class="badge badge--area">${item.parentArea}</span>`);
  if (item.location) bits.push(`<span class="badge badge--area">${item.location}</span>`);
  if (item.meta) bits.push(`<span class="badge badge--meta">${item.meta}</span>`);
  // A long `note` is a sentence, not a label — it wraps to three lines and
  // wrecks the row. The access badges carry the same signal; the full text is
  // in the sheet.
  if (item.note && !item.parentArea && item.note.length <= 30) {
    bits.push(`<span class="badge badge--note">${item.note}</span>`);
  }
  const access = accessBadges(item.access, ui.accessLabels);
  if (access) bits.push(access);
  return bits.length ? `<div class="row-meta">${bits.join("")}</div>` : "";
}

/**
 * A list row. Every row has the same shape so a list scans cleanly; rating
 * shows through colour only — gold stars and a gold edge for a three-star
 * entry, a muted dashed line for a zero-star one.
 */
export function row(entry, ui, icon) {
  const { item, viewId, groupId } = entry;
  const feature = item.rating === 3 && !item.inactive;
  const muted = item.rating === 0 || item.inactive;
  const hasPhoto = !!(item.image && item.image.src);
  const cls = ["row", feature && "row--feature", muted && "row--muted"]
    .filter(Boolean)
    .join(" ");

  const aka = item.aka ? ` <span class="row-aka">(${item.aka})</span>` : "";
  const stars =
    item.rating === undefined || item.rating === null
      ? ""
      : `<span class="row-stars">${coloredStars(item.rating, "stars--sm")}</span>`;
  return `<a class="${cls}" href="#/${viewId}/${groupId}/${item.id}">
      ${feature || hasPhoto ? `<span class="row-media">${media(item, icon)}</span>` : ""}
      <span class="row-main">
        <span class="row-title"><span class="row-name">${item.name}${aka}</span>${stars}</span>
        ${metaLine(item, ui)}
      </span>
      <span class="row-chevron" aria-hidden="true">›</span>
    </a>`;
}

/** Short prose entries (local dishes, products) — nothing to hide behind a tap. */
export function note(item) {
  return `<div class="note-card">
      <div class="note-head"><h3 class="note-name">${item.name}</h3>${tags(item.tags)}</div>
      <p class="note-desc">${item.description}</p>
    </div>`;
}

/* ─── Detail (sheet body) ────────────────────────────────────── */

export function detail(entry, icon) {
  const ui = state.ui;
  const { item } = entry;
  const hasPhoto = item.image && item.image.src;

  const badges = [
    item.inactive && `<span class="badge badge--inactive">${ui.inactiveLabel}</span>`,
    item.parentArea && `<span class="badge badge--area">${item.parentArea}</span>`,
    item.location && `<span class="badge badge--area">${item.location}</span>`,
    item.locationDetail && `<span class="badge badge--note">${item.locationDetail}</span>`,
    item.meta && `<span class="badge badge--meta">${item.meta}</span>`,
    item.note && `<span class="badge badge--note">${item.note}</span>`,
    accessBadges(item.access, ui.accessLabels),
  ]
    .filter(Boolean)
    .join("");

  const mustTry =
    item.mustTry && item.mustTry.length
      ? `<div class="must-try"><span class="must-try-label">${ui.mustTryLabel}</span>${item.mustTry
          .map((x) => `<span class="must-try-item">${x}</span>`)
          .join("")}</div>`
      : "";

  const tip = item.tips
    ? `<div class="card-tip"><span aria-hidden="true">💡</span><span>${item.tips}</span></div>`
    : "";

  const miniMap = item.lat && item.lng ? `<div class="detail-map" id="detail-map"></div>` : "";

  const actions = [
    item.mapsUrl &&
      `<a class="btn btn--primary" href="${item.mapsUrl}" target="_blank" rel="noopener noreferrer">${ui.mapsLink} ↗</a>`,
    item.lat && item.lng && `<a class="btn" href="#/map/${item.id}">${ui.map.openLabel}</a>`,
  ]
    .filter(Boolean)
    .join("");

  return `<article class="detail">
      ${
        hasPhoto
          ? `<div class="detail-media">
        <div class="media-frame">
          <img class="media-bg" src="${item.image.src}" alt="" aria-hidden="true" />
          <img class="media-img" src="${item.image.src}" alt="${item.name || ""}" />
        </div>${mediaCredit(item)}
      </div>`
          : ""
      }
      <header class="detail-head">
        <h2 class="detail-title" id="sheet-title">${item.name}${
          item.aka ? ` <span class="row-aka">(${item.aka})</span>` : ""
        }</h2>
        ${item.rating !== undefined && item.rating !== null ? ratingBlock(item.rating, ui.ratingLabels) : ""}
        ${badges ? `<div class="detail-badges">${badges}</div>` : ""}
      </header>
      ${item.description ? `<p class="detail-body">${item.description}</p>` : ""}
      ${tip}
      ${mustTry}
      ${nearby(item.nearbyLinks, item.nearbyLabel || ui.nearbyLabel)}
      ${contacts(item.contacts, ui.contactsLabel)}
      ${miniMap}
      ${actions ? `<div class="detail-actions">${actions}</div>` : ""}
      ${tags(item.tags)}
    </article>`;
}

/* ─── Practical tips ─────────────────────────────────────────── */

export const TIP_ICONS = {
  wind: "💨", mountain: "⛰️", gift: "🎁", people: "🗣️", ferry: "⛴️",
  bus: "🚌", taxi: "🚕", parking: "🅿️", water: "💧", shop: "🛒",
};

export function tipCard(item, weatherSlot) {
  const ui = state.ui;
  return `<div class="tip-card">
      <div class="tip-card-icon">${TIP_ICONS[item.icon] || "📌"}</div>
      <div class="tip-card-content">
        <h3 class="tip-card-title">${item.title}</h3>
        <p class="tip-card-desc">${item.description}</p>
        ${item.highlight ? `<div class="tip-card-highlight">${item.highlight}</div>` : ""}
        ${nearby(item.nearbyLinks, item.nearbyLabel || ui.nearbyLabel)}
        ${contacts(item.contacts, ui.contactsLabel)}
        ${item.widget === "weather" ? weatherSlot || "" : ""}
        ${item.embed || item.download ? `<div class="tip-actions">${embed(item.embed)}${download(item.download)}</div>` : ""}
      </div>
    </div>`;
}

/* ─── History timeline ───────────────────────────────────────── */

export function timeline(chapters) {
  return `<div class="timeline">${chapters
    .map(
      (c) => `<article class="timeline-item" id="tl-${c.id}">
        ${c.era ? `<span class="timeline-era">${c.era}</span>` : ""}
        <h3 class="timeline-title">${c.title}</h3>
        <p class="timeline-body">${c.body}</p>
      </article>`,
    )
    .join("")}</div>`;
}

/* ─── Festival calendar ──────────────────────────────────────── */

export function calendar(items) {
  const cfg = state.ui.calendar;
  if (!cfg) return "";

  const dayMap = {};
  items.forEach((item) => {
    if (!item.month || !item.day) return;
    for (let d = item.day; d <= (item.endDay || item.day); d++) {
      dayMap[`${item.month}-${d}`] = item;
    }
  });
  if (!Object.keys(dayMap).length) return "";

  const used = [...new Set(items.filter((i) => i.month).map((i) => i.month))];
  const first = Math.min(5, ...used);
  const last = Math.max(9, ...used);
  // Mid-season, start at the current month — nobody on the island in August
  // wants to scroll past May, June and July. Off-season, show the whole run.
  const thisMonth = new Date().getMonth() + 1;
  const start = thisMonth >= first && thisMonth <= last ? thisMonth : first;
  const months = [];
  for (let m = start; m <= last; m++) months.push(m);

  const now = new Date();
  const todayKey = `${now.getMonth() + 1}-${now.getDate()}`;

  return `<div class="calendar">${months
    .map((m) => month(cfg.year, m, dayMap, cfg, todayKey))
    .join("")}</div>`;
}

function month(year, m, dayMap, cfg, todayKey) {
  const days = new Date(year, m, 0).getDate();
  const offset = (new Date(year, m - 1, 1).getDay() + 6) % 7; // Monday first

  let cells = cfg.weekdays.map((w) => `<div class="cal-weekday">${w}</div>`).join("");
  for (let i = 0; i < offset; i++) cells += `<div class="cal-day cal-day--empty"></div>`;

  for (let d = 1; d <= days; d++) {
    const key = `${m}-${d}`;
    const item = dayMap[key];
    const today = key === todayKey ? " is-today" : "";
    cells += item
      ? `<a class="cal-day cal-day--event${today}" href="#/culture/panigyria/${item.id}" title="${item.name}" aria-label="${item.name} — ${d}">${d}</a>`
      : `<div class="cal-day${today}">${d}</div>`;
  }

  return `<div class="cal-month">
      <div class="cal-month-name">${cfg.monthsShort[m - 1]} ${year}</div>
      <div class="cal-grid">${cells}</div>
    </div>`;
}

export { t };
