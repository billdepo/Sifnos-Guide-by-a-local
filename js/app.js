/**
 * Sifnos guide — app shell.
 *
 * Boots the content, wires the chrome (app bar, tab bar, drawer) and maps
 * routes onto views. Everything below this file is stateless rendering.
 */

import { state, setLang, loadContent, VIEW_ICONS } from "./store.js";
import * as router from "./router.js";
import * as views from "./views.js";
import * as sheet from "./sheet.js";
import * as maps from "./map.js";

const el = (id) => document.getElementById(id);

let prevRoute = null;
let lastViewKey = null; // view+group+filters — tells a view change from a sheet open

/* ─── Chrome ─────────────────────────────────────────────────── */

const TAB_IDS = ["home", "beaches", "food", "map"];

function renderChrome() {
  const u = state.ui;

  el("appbar-brand").textContent = state.meta.title;
  el("appbar-back").setAttribute("aria-label", u.back);
  el("appbar-back").innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
  el("appbar-home").setAttribute("aria-label", u.home);
  el("appbar-home").setAttribute("title", u.home);
  el("appbar-search").setAttribute("aria-label", u.searchTitle);
  el("lang-toggle").textContent = u.languageToggle;
  el("lang-toggle").setAttribute("aria-label", "Switch language");

  // Desktop inline nav
  el("appbar-links").innerHTML = state.order
    .map((id) => `<a class="appbar-link" data-view="${id}" href="#/${id}">${state.views[id].label}</a>`)
    .join("") + `<a class="appbar-link" data-view="map" href="#/map">${u.map.title}</a>`;

  // Mobile bottom tabs
  el("tabbar").innerHTML =
    TAB_IDS.map((id) => {
      const label = id === "home" ? u.home : id === "map" ? u.map.title : state.views[id].label;
      return `<a class="tab" data-view="${id}" href="#/${id === "home" ? "" : id}">
          <span class="tab-icon" aria-hidden="true">${id === "home" ? "🏠" : VIEW_ICONS[id]}</span>
          <span class="tab-label">${label}</span>
        </a>`;
    }).join("") +
    `<button class="tab" id="tab-more">
        <span class="tab-icon" aria-hidden="true">☰</span>
        <span class="tab-label">${u.more}</span>
      </button>`;

  // Drawer
  el("drawer-title").textContent = state.meta.title;
  el("drawer-close").setAttribute("aria-label", u.close);
  el("drawer-close").textContent = "✕";
  el("drawer-links").innerHTML =
    `<a class="drawer-link" data-view="home" href="#/"><span aria-hidden="true">🏠</span>${u.home}</a>` +
    state.order
      .map(
        (id) =>
          `<a class="drawer-link" data-view="${id}" href="#/${id}"><span aria-hidden="true">${VIEW_ICONS[id]}</span>${state.views[id].label}</a>`,
      )
      .join("") +
    `<a class="drawer-link" data-view="map" href="#/map"><span aria-hidden="true">${VIEW_ICONS.map}</span>${u.map.title}</a>`;
}

function updateChromeState(route) {
  const isHome = route.view === "home";
  const isSearch = route.view === "search";

  el("appbar-back").hidden = isHome;
  // Back only goes one step; this is the way out from anywhere. It matters
  // most on desktop, where the brand is hidden and there is no tab bar.
  el("appbar-home").hidden = isHome;
  el("appbar-brand").hidden = !isHome;
  el("appbar-search").hidden = isSearch;

  const title = isHome
    ? ""
    : isSearch
      ? state.ui.searchTitle
      : route.view === "map"
        ? state.ui.map.title
        : route.view === "collection"
          ? state.ui.collections[route.group]?.title || ""
          : state.views[route.view]?.label || "";
  el("appbar-title").textContent = title;
  el("appbar-title").hidden = isHome;

  document.querySelectorAll("[data-view]").forEach((node) => {
    node.classList.toggle("is-on", node.dataset.view === route.view);
  });
}

/* ─── Drawer ─────────────────────────────────────────────────── */

function openDrawer() {
  el("drawer").removeAttribute("hidden");
  document.body.classList.add("no-scroll");
}
function closeDrawer() {
  el("drawer").setAttribute("hidden", "");
  if (!sheet.isOpen()) document.body.classList.remove("no-scroll");
}

function setupDrawer() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("#tab-more")) return openDrawer();
    if (
      e.target.closest("#drawer-close") ||
      e.target.closest(".drawer-link") ||
      e.target.closest(".drawer-actions a") ||
      e.target === el("drawer")
    ) {
      closeDrawer();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el("drawer").hasAttribute("hidden")) closeDrawer();
  });
}

/* ─── Routing ────────────────────────────────────────────────── */

function onRoute(route) {
  const { view, group, item, filters, query } = route;

  // Key identifies the *underlying* screen. Opening a detail sheet leaves it
  // unchanged, which is what preserves the list's scroll position.
  const key = `${view}|${group || ""}|${filters.join(",")}|${query.q || ""}`;
  const viewChanged = key !== lastViewKey;

  if (viewChanged) {
    lastViewKey = key;

    if (view === "home") views.home();
    else if (view === "search") views.searchView(query.q || "");
    else if (view === "map") views.map(group);
    else if (view === "collection") views.collection(group);
    else if (state.views[view]) {
      const v = state.views[view];
      if (v.kind === "timeline") views.timeline(v);
      else if (v.kind === "tips") views.tips(v);
      else views.list(v, group, filters);
    } else {
      views.notFound();
    }

    if (!item) window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  updateChromeState(route);

  // Detail sheet
  const entry = item ? state.byId.get(item) : null;
  if (entry) {
    const cameFromList =
      prevRoute && prevRoute.view === view && prevRoute.group === group && !prevRoute.item;
    sheet.open(entry, {
      icon: VIEW_ICONS[entry.viewId],
      canPop: !!cameFromList,
      closeTo: router.href(entry.viewId, entry.groupId, null, { f: filters.join(",") }),
    });
  } else {
    sheet.dismiss();
  }

  prevRoute = route;
}

/* ─── Global interactions ────────────────────────────────────── */

function setupLazyEmbeds() {
  // "toggle" doesn't bubble — capture so one listener covers every embed,
  // including ones added by a later render.
  document.addEventListener(
    "toggle",
    (e) => {
      const d = e.target;
      if (!d.classList?.contains("card-embed") || !d.open) return;
      const frame = d.querySelector("iframe[data-src]");
      if (frame) {
        frame.src = frame.dataset.src;
        frame.removeAttribute("data-src");
      }
    },
    true,
  );
}

/** Cross-references written into descriptions, e.g. "see the rocky side". */
function setupCardLinks() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".card-link[data-target]");
    if (!link) return;
    e.preventDefault();
    const target = state.byId.get(link.dataset.target);
    if (target) router.go(`#/${target.viewId}/${target.groupId}/${target.item.id}`);
  });
}

/** Live search: results update per keystroke, the URL follows without
 *  pushing history (which would make Back walk letter by letter). */
function setupSearchInput() {
  document.addEventListener("input", (e) => {
    const input = e.target.closest("#search-input");
    if (!input) return;
    const q = input.value;
    const results = el("search-results");
    if (results) results.innerHTML = views.searchResults(q);
    const clear = el("search-clear");
    if (clear) clear.hidden = !q;

    const url = router.href("search", null, null, { q });
    history.replaceState(history.state, "", url);
    lastViewKey = `search||${""}|${q}`; // keep the router in step
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#search-clear")) return;
    const input = el("search-input");
    if (!input) return;
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  });

  // Enter on mobile should dismiss the keyboard, not submit anything
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.closest("#search-input")) {
      e.preventDefault();
      e.target.blur();
    }
  });
}

function setupLangToggle() {
  el("lang-toggle").addEventListener("click", async () => {
    setLang(state.lang === "el" ? "en" : "el");
    await loadContent(state.lang);
    document.documentElement.lang = state.meta.lang;
    document.title = `${state.meta.title} — ${state.meta.subtitle}`;
    renderChrome();
    lastViewKey = null; // force a full re-render in the new language
    onRoute(router.parse());
  });
}

function setupSearchButton() {
  el("appbar-search").addEventListener("click", () => router.go("#/search"));
  el("appbar-back").addEventListener("click", () => {
    if (router.depth() > 0) router.back();
    else router.go("#/");
  });
}

/* ─── Boot ───────────────────────────────────────────────────── */

async function init() {
  try {
    await loadContent(state.lang);
    document.documentElement.lang = state.meta.lang;
    document.title = `${state.meta.title} — ${state.meta.subtitle}`;

    renderChrome();
    sheet.init();
    setupDrawer();
    setupLazyEmbeds();
    setupCardLinks();
    setupSearchInput();
    setupSearchButton();
    setupLangToggle();

    if (!location.hash) history.replaceState({ depth: 0 }, "", "#/");
    router.start(onRoute);

    // Leaflet measures 0×0 if the container was hidden when it was created
    addEventListener("resize", () => {
      maps.invalidate("full-map");
      maps.invalidate("detail-map");
    });
  } catch (err) {
    document.body.innerHTML = `
      <div style="padding:2rem;font-family:system-ui,sans-serif;line-height:1.6">
        <strong>Error loading content:</strong> ${err.message}<br><br>
        This app uses ES modules and fetch — it must be served over HTTP, not opened as a file.<br><br>
        <code>npx serve .</code> &nbsp;or&nbsp; <code>python -m http.server 8000</code>
      </div>`;
  }
}

init();
