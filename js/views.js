/**
 * View rendering. Exactly one view lives in #view at a time, which is what
 * keeps a 120-item guide down to a couple of screens of scrolling on a phone.
 */

import {
  state, t, search, shelteredFrom, mappable, nextEvent, VIEW_ICONS,
} from "./store.js";
import * as ui from "./ui.js";
import * as maps from "./map.js";
import * as weather from "./weather.js";
import { href } from "./router.js";

const el = (id) => document.getElementById(id);
const mount = (html) => {
  maps.destroyAll();
  el("view").innerHTML = html;
};

/* ═══ Filters ═══════════════════════════════════════════════════
   Every filter is derived from data the JSON already carries, so adding a
   beach automatically makes its access mode filterable. */

const ACCESS_ORDER = ["car", "walking", "hike", "boat"];

export function availableFilters(items) {
  const out = [];
  if (items.some((i) => i.rating === 3)) {
    out.push({ id: "must", label: `★ ${state.ui.filters.mustOnly}` });
  }
  const access = new Set();
  items.forEach((i) => (i.access || []).forEach((a) => access.add(a)));
  for (const a of ACCESS_ORDER) {
    if (access.has(a)) out.push({ id: `a-${a}`, label: state.ui.accessLabels[a] });
  }
  if (items.some((i) => (i.shelteredFrom || []).length)) {
    out.push({ id: "sheltered", label: `🛡️ ${state.ui.filters.sheltered}`, windy: true });
  }
  return out;
}

export function applyFilters(items, filters) {
  if (!filters.length) return items;
  return items.filter((item) => {
    for (const f of filters) {
      if (f === "must" && item.rating !== 3) return false;
      if (f === "sheltered" && !(item.shelteredFrom || []).includes("N")) return false;
      if (f.startsWith("a-") && !(item.access || []).includes(f.slice(2))) return false;
    }
    return true;
  });
}

function filterBar(available, active, base) {
  if (!available.length) return "";
  const chips = available
    .map((f) => {
      const on = active.includes(f.id);
      const next = on ? active.filter((x) => x !== f.id) : [...active, f.id];
      return `<a class="chip${on ? " is-on" : ""}" href="${base(next)}" data-replace="true">${f.label}</a>`;
    })
    .join("");
  const clear = active.length
    ? `<a class="chip chip--clear" href="${base([])}" data-replace="true">✕ ${state.ui.filters.clear}</a>`
    : "";
  return `<div class="filterbar" role="group" aria-label="${state.ui.filters.label}">${chips}${clear}</div>`;
}

function countLabel(n) {
  const f = state.ui.filters;
  return n === 1 ? f.resultsOne : t(f.results, { n });
}

/* ═══ Home ══════════════════════════════════════════════════════ */

export function home() {
  const m = state.meta;
  const u = state.ui;

  const tiles = state.order
    .map((id) => {
      const v = state.views[id];
      const n = v.groups.reduce((a, g) => a + g.items.length, 0);
      return `<a class="tile" href="#/${id}">
          <span class="tile-icon" aria-hidden="true">${VIEW_ICONS[id]}</span>
          <span class="tile-label">${v.label}</span>
          <span class="tile-count">${n}</span>
        </a>`;
    })
    .join("");

  const mapTile = `<a class="tile tile--map" href="#/map">
      <span class="tile-icon" aria-hidden="true">${VIEW_ICONS.map}</span>
      <span class="tile-label">${u.map.title}</span>
      <span class="tile-count">${mappable().length}</span>
    </a>`;

  mount(`
    <section class="home-hero" style="background-image:linear-gradient(180deg,rgba(10,30,60,.45),rgba(10,30,60,.72)),url('${m.heroImageUrl}')">
      <h1 class="home-title">${m.title}</h1>
      <p class="home-subtitle">${m.subtitle}</p>
    </section>

    <div class="home-body">
      <a class="searchbox" href="#/search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>${u.search.placeholder}</span>
      </a>

      <section class="home-section">
        <h2 class="home-heading">${u.todayLabel}</h2>
        <div class="wx-card" data-weather="now"><div class="wx-loading">${u.weather.loading}</div></div>
        ${eventStrip()}
      </section>

      <section class="home-section" id="home-collections"></section>

      <section class="home-section">
        <h2 class="home-heading">${u.exploreLabel}</h2>
        <div class="tiles">${tiles}${mapTile}</div>
      </section>

      ${footer()}
    </div>`);

  // The "out of the wind" shortcut only makes sense on a windy day, so it is
  // added once the forecast lands rather than rendered unconditionally.
  weather.fillSlots().then((s) => {
    if (!s || !s.windy || !s.northerly) return;
    const host = el("home-collections");
    if (host) {
      host.insertAdjacentHTML(
        "beforeend",
        collectionCard("sheltered", u.collections.sheltered, shelteredFrom("N").length),
      );
    }
  });
}

function collectionCard(id, copy, count) {
  return `<a class="collection-card collection-card--${id}" href="#/collection/${id}">
      <span class="collection-text">
        <span class="collection-title">${copy.title}</span>
        <span class="collection-sub">${copy.subtitle}</span>
      </span>
      <span class="collection-count">${count}</span>
    </a>`;
}

function eventStrip() {
  const next = nextEvent();
  if (!next) return "";
  const u = state.ui;
  const label = next.isToday ? u.todayEventLabel : u.nextEventLabel;
  const months = u.calendar.monthsShort;
  // The next dated thing can be a panigyri or a one-off event, so link to
  // wherever it actually lives rather than assuming the panigyria tab.
  return `<a class="event-strip${next.isToday ? " is-today" : ""}" href="#/${next.viewId}/${next.groupId}/${next.item.id}">
      <span class="event-date">
        <span class="event-day">${next.item.day}</span>
        <span class="event-month">${months[next.item.month - 1]}</span>
      </span>
      <span class="event-text">
        <span class="event-label">${label}</span>
        <span class="event-name">${next.item.name}</span>
        ${next.item.location ? `<span class="event-place">${next.item.location}</span>` : ""}
      </span>
      <span class="row-chevron" aria-hidden="true">›</span>
    </a>`;
}

function footer() {
  return `<footer class="home-footer">
      <a class="bmac-btn" href="#" target="_blank" rel="noopener noreferrer">☕ Buy me a coffee</a>
      <p class="footer-text">Made with ♥ by a local &nbsp;·&nbsp; Σίφνος</p>
    </footer>`;
}

/* ═══ List views ════════════════════════════════════════════════ */

export function list(view, groupId, filters) {
  const group = view.groups.find((g) => g.id === groupId) || view.groups[0];
  const icon = VIEW_ICONS[view.id];
  const u = state.ui;

  const tabs =
    view.groups.length > 1
      ? `<div class="groupbar" role="tablist">${view.groups
          .map(
            (g) =>
              `<a class="chip-tab${g.id === group.id ? " is-on" : ""}" role="tab" aria-selected="${g.id === group.id}" href="#/${view.id}/${g.id}">${g.label}</a>`,
          )
          .join("")}</div>`
      : "";

  const available = availableFilters(group.items);
  const base = (f) => href(view.id, group.id, null, { f: f.join(",") });
  const shown = applyFilters(group.items, filters);

  const mapPoints = shown.filter((i) => i.lat && i.lng).length;
  const ribbon = mapPoints
    ? `<a class="map-ribbon" href="#/map">
        <span class="map-ribbon-icon" aria-hidden="true">🗺️</span>
        <span>${u.map.openLabel}</span>
        <span class="map-ribbon-count">${t(u.map.pointsLabel, { n: mapPoints })}</span>
      </a>`
    : "";

  const hasCalendar = group.items.some((i) => i.month && i.day);

  let body;
  if (!shown.length) {
    body = `<p class="empty">${u.filters.empty}</p>`;
  } else if (group.display === "notes") {
    body = `<div class="notes">${shown.map(ui.note).join("")}</div>`;
  } else {
    body = `<div class="rows">${shown
      .map((item) => ui.row({ item, viewId: view.id, groupId: group.id }, u, icon))
      .join("")}</div>`;
  }

  mount(`
    <header class="view-head">
      <h1 class="view-title">${view.label}</h1>
      ${view.intro ? `<p class="view-intro">${view.intro}</p>` : ""}
    </header>
    ${tabs}
    <div class="view-body">
      ${group.intro ? `<p class="group-intro">${group.intro}</p>` : ""}
      ${hasCalendar ? ui.calendar(group.items) : ""}
      ${ui.embed(group.embed)}
      ${ribbon}
      ${filterBar(available, filters, base)}
      ${available.length && filters.length ? `<p class="result-count">${countLabel(shown.length)}</p>` : ""}
      ${body}
    </div>`);
}

/* ═══ History ═══════════════════════════════════════════════════ */

export function timeline(view) {
  mount(`
    <header class="view-head">
      <h1 class="view-title">${view.label}</h1>
      ${view.intro ? `<p class="view-intro">${view.intro}</p>` : ""}
    </header>
    <div class="view-body">${ui.timeline(view.groups[0].items)}</div>`);
}

/* ═══ Practical ═════════════════════════════════════════════════ */

export function tips(view) {
  const u = state.ui;
  const weatherSlot = `<details class="card-embed">
      <summary>💨 ${u.weather.toggleLabel}</summary>
      <div class="wx-panel" data-weather="full"><div class="wx-loading">${u.weather.loading}</div></div>
    </details>`;

  mount(`
    <header class="view-head">
      <h1 class="view-title">${view.label}</h1>
      ${view.intro ? `<p class="view-intro">${view.intro}</p>` : ""}
    </header>
    <div class="view-body">
      <div class="tips-grid">${view.groups[0].items
        .map((item) => ui.tipCard(item, weatherSlot))
        .join("")}</div>
    </div>`);

  weather.fillSlots();
}

/* ═══ Map ═══════════════════════════════════════════════════════ */

export function map(focusId) {
  const u = state.ui;
  const entries = mappable();
  const legend = ["3", "2", "1", "0"]
    .map(
      (r) =>
        `<span class="legend-item">${ui.coloredStars(Number(r))}<span class="legend-label">${u.ratingLabels[r]}</span></span>`,
    )
    .join("");

  mount(`
    <div class="map-view">
      <div class="map-canvas" id="full-map"></div>
      <div class="map-legend">${legend}<span class="legend-count">${t(u.map.pointsLabel, { n: entries.length })}</span></div>
    </div>`);

  maps.render("full-map", entries, { focusId, interactive: true });
}

/* ═══ Search ════════════════════════════════════════════════════ */

export function searchView(query) {
  const u = state.ui;
  mount(`
    <div class="search-view">
      <div class="search-field">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" id="search-input" class="search-input" value="${(query || "").replace(/"/g, "&quot;")}"
               placeholder="${u.search.placeholder}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
        <button class="search-clear" id="search-clear" aria-label="${u.close}" ${query ? "" : "hidden"}>✕</button>
      </div>
      <div id="search-results">${searchResults(query)}</div>
    </div>`);

  const input = el("search-input");
  // Focus only when arriving empty, so re-rendering on each keystroke of a
  // shared link doesn't yank the caret around.
  if (!query) setTimeout(() => input?.focus(), 60);
}

export function searchResults(query) {
  const u = state.ui;
  if (!query || query.trim().length < 2) {
    return `<p class="search-hint">${u.searchHint}</p>`;
  }
  const hits = search(query);
  if (!hits.length) {
    return `<p class="empty">${t(u.searchEmpty, { q: query })}</p>`;
  }

  // Group by section so 12 results across 5 sections still read cleanly
  const bySection = new Map();
  for (const hit of hits) {
    if (!bySection.has(hit.viewId)) bySection.set(hit.viewId, []);
    bySection.get(hit.viewId).push(hit);
  }

  return [...bySection.entries()]
    .map(
      ([viewId, list]) => `<section class="search-group">
        <h2 class="search-group-title">${VIEW_ICONS[viewId]} ${state.views[viewId].label}</h2>
        <div class="rows">${list
          .map((hit) => ui.row(hit, u, VIEW_ICONS[viewId]))
          .join("")}</div>
      </section>`,
    )
    .join("");
}

/* ═══ Collections ═══════════════════════════════════════════════ */

export function collection(id) {
  const u = state.ui;
  const copy = u.collections[id];
  if (!copy) return notFound();

  const entries = shelteredFrom("N");

  mount(`
    <header class="view-head">
      <h1 class="view-title">${copy.title}</h1>
      <p class="view-intro">${copy.subtitle}</p>
    </header>
    <div class="view-body">
      <p class="result-count">${countLabel(entries.length)}</p>
      ${
        entries.length
          ? `<div class="rows">${entries
              .map((e) => ui.row(e, u, VIEW_ICONS[e.viewId]))
              .join("")}</div>`
          : `<p class="empty">${u.filters.empty}</p>`
      }
    </div>`);
}

export function notFound() {
  mount(`<div class="view-body"><p class="empty">404</p><p><a class="btn btn--primary" href="#/">${state.ui.home}</a></p></div>`);
}
