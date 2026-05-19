"use strict";

// ─── State ────────────────────────────────────────────────────
const STORAGE_KEY = "sifnos-guide-lang";
const DEFAULT_LANG = "el";

const state = {
  lang: localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG,
  data: null,
};

let _beachMap = null;
let _beachMarkers = {};

// ─── DOM Helpers ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function setHTML(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

// ─── Data ─────────────────────────────────────────────────────
async function fetchContent(lang) {
  const res = await fetch(`content/${lang}.json`);
  if (!res.ok) throw new Error(`Cannot load content/${lang}.json`);
  return res.json();
}

// ─── Render Utilities ─────────────────────────────────────────

function renderStars(rating, labels) {
  if (rating === 0) {
    return `<span class="rating-none" aria-label="${labels["0"]}">✗ <span>${labels["0"]}</span></span>`;
  }
  const filled = "★".repeat(rating);
  const empty = "★".repeat(3 - rating);
  return `
    <div class="stars" aria-label="${labels[String(rating)]}">
      <span class="stars-filled" aria-hidden="true">${filled}</span><span class="stars-empty" aria-hidden="true">${empty}</span>
      <span class="stars-label">${labels[String(rating)]}</span>
    </div>`;
}

function renderTags(arr) {
  if (!arr || !arr.length) return "";
  return `<div class="tags">${arr.map((t) => `<span class="tag">${t}</span>`).join("")}</div>`;
}

function renderAccessBadges(arr, labels) {
  if (!arr || !arr.length) return "";
  return arr
    .map((a) => `<span class="access access--${a}">${labels[a] || a}</span>`)
    .join("");
}

function renderMapsLink(url, label) {
  if (!url) return "";
  return `<a class="maps-link" href="${url}" target="_blank" rel="noopener noreferrer">${label} →</a>`;
}

function renderNearby(links, label) {
  if (!links || !links.length) return "";
  const items = links
    .map(
      (l) => `
      <li class="nearby-item">
        ${l.icon ? `<span class="nearby-icon">${l.icon}</span>` : ""}
        <a class="nearby-link" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.name}<span class="nearby-arrow">↗</span></a>${l.note ? ` <span class="nearby-note">— ${l.note}</span>` : ""}
      </li>`,
    )
    .join("");
  return `
    <div class="nearby">
      <span class="nearby-label">📍 ${label || "Κοντά"}:</span>
      <ul class="nearby-list">${items}</ul>
    </div>`;
}

// ─── Hero & Nav ───────────────────────────────────────────────

function renderMeta(meta) {
  document.documentElement.lang = meta.lang;
  document.title = `${meta.title} — ${meta.subtitle}`;
  setHTML("hero-title", meta.title);
  setHTML("hero-subtitle", meta.subtitle);
  setHTML("hero-description", meta.description);

  if (meta.heroImageUrl) {
    document.querySelector(".hero").style.backgroundImage =
      `linear-gradient(180deg, rgba(10,30,60,0.52) 0%, rgba(10,30,60,0.70) 100%), url('${meta.heroImageUrl}')`;
    document.querySelector(".hero").style.backgroundSize = "cover";
    document.querySelector(".hero").style.backgroundPosition = "50% 54%";
  }
}

function renderNav(nav, ui) {
  const linksHTML = Object.entries(nav)
    .map(
      ([id, label]) =>
        `<a class="nav-link" href="#${id}" role="listitem">${label}</a>`,
    )
    .join("");
  setHTML("nav-links", linksHTML);

  document.querySelectorAll(".lang-toggle").forEach((btn) => {
    btn.textContent = ui.languageToggle;
  });

  if (ui.search) {
    const input = $("search-input");
    const msg = $("search-coming-soon");
    if (input) input.placeholder = ui.search.placeholder;
    if (msg) msg.textContent = ui.search.comingSoon;
  }
}

// ─── Section: Beaches ─────────────────────────────────────────

function renderBeaches(data, ui) {
  const tabs = data.subsections
    .map(
      (sub, i) =>
        `<button class="tab${i === 0 ? " is-active" : ""}" data-group="beaches" data-tab="${sub.id}" role="tab" aria-selected="${i === 0}">${sub.label}</button>`,
    )
    .join("");

  setHTML(
    "beaches-header",
    `
    <h2 class="section-title">${data.label}</h2>
    <p class="section-intro">${data.intro}</p>
    <div class="tip-banner tip-banner--wind">
      <span class="tip-icon">💨</span>
      <p>${data.windTip}</p>
    </div>
    <div class="tabs" role="tablist">${tabs}</div>`,
  );

  const panels = data.subsections
    .map(
      (sub, i) => `
      <div class="panel${i === 0 ? " is-active" : ""}" data-group="beaches" data-panel="${sub.id}">
        <div class="card-grid">
          ${sub.items.map((item) => beachCard(item, ui)).join("")}
        </div>
      </div>`,
    )
    .join("");

  setHTML("beaches-body", `<div id="beach-map" class="beach-map"></div>${panels}`);

  initBeachMap(data.subsections[0].items, ui);
}

function beachCard(item, ui) {
  const parentArea = item.parentArea
    ? `<span class="badge badge--area">${item.parentArea}</span>`
    : "";
  const note = item.note
    ? `<span class="badge badge--note">${item.note}</span>`
    : "";
  const tip = item.tips
    ? `<div class="card-tip"><span class="tip-dot">💡</span><span>${item.tips}</span></div>`
    : "";

  const mappable = item.lat && item.lng ? ` data-beach-id="${item.id}"` : "";
  const cardId = item.id ? ` data-card-id="${item.id}"` : "";

  return `
    <article class="card${item.rating === 0 ? " card--skip" : ""}${mappable ? " card--mappable" : ""}"${mappable}${cardId}>
      <div class="card-top">
        <div class="card-name-row">
          <h4 class="card-name">${item.name}</h4>
          ${renderStars(item.rating, ui.ratingLabels)}
        </div>
        <div class="card-badges">
          ${parentArea}${note}
          ${renderAccessBadges(item.access, ui.accessLabels)}
        </div>
      </div>
      <p class="card-body">${item.description}</p>
      ${renderNearby(item.nearbyLinks, item.nearbyLabel || ui.nearbyLabel)}
      ${tip}
      <div class="card-bottom">
        ${renderTags(item.tags)}
        ${renderMapsLink(item.mapsUrl, ui.mapsLink)}
      </div>
    </article>`;
}

// ─── Beach Map ────────────────────────────────────────────────

function initBeachMap(items, ui) {
  if (typeof L === "undefined") return;
  if (_beachMap) {
    _beachMap.remove();
    _beachMap = null;
  }
  _beachMarkers = {};

  const el = document.getElementById("beach-map");
  if (!el) return;

  const mapped = items.filter((item) => item.lat && item.lng);
  el.style.display = mapped.length ? "" : "none";
  if (!mapped.length) return;

  _beachMap = L.map("beach-map");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(_beachMap);

  const colors = { 3: "#2d6a4f", 2: "#1A4F7A", 1: "#C0623B", 0: "#888" };
  const bounds = [];

  mapped.forEach((item) => {
    const marker = L.circleMarker([item.lat, item.lng], {
      radius: 10,
      fillColor: colors[item.rating] || "#888",
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(_beachMap);

    const label = ui.ratingLabels[String(item.rating)] || "";
    const mapsLink = item.mapsUrl
      ? `<br><a href="${item.mapsUrl}" target="_blank" rel="noopener">↗ Google Maps</a>`
      : "";
    marker.bindPopup(
      `<strong>${item.name}</strong><br><small>${label}</small>${mapsLink}`,
    );
    if (item.id) _beachMarkers[item.id] = marker;
    bounds.push([item.lat, item.lng]);
  });

  _beachMap.fitBounds(bounds, { padding: [40, 40] });
}

// ─── Section: Drinks ──────────────────────────────────────────

function renderDrinks(data, ui) {
  setHTML(
    "drinks-header",
    `
    <h2 class="section-title">${data.label}</h2>
    <p class="section-intro">${data.intro}</p>`,
  );

  setHTML(
    "drinks-body",
    data.areas
      .map(
        (area) => `
      <div class="subsection">
        <h3 class="subsection-title">${area.areaName}</h3>
        ${area.intro ? `<p class="subsection-intro">${area.intro}</p>` : ""}
        <div class="card-grid">
          ${area.items.map((item) => drinkCard(item, ui)).join("")}
        </div>
      </div>`,
      )
      .join(""),
  );
}

function drinkCard(item, ui) {
  const nameDisplay = item.aka
    ? `${item.name} <span class="aka">(${item.aka})</span>`
    : item.name;

  const mustTry =
    item.mustTry && item.mustTry.length
      ? `<div class="must-try">
        <span class="must-try-label">${ui.mustTryLabel}</span>
        ${item.mustTry.map((t) => `<span class="must-try-item">${t}</span>`).join("")}
       </div>`
      : "";

  const note = item.note ? `<div class="card-note">${item.note}</div>` : "";

  return `
    <article class="card">
      <div class="card-top">
        <div class="card-name-row">
          <h4 class="card-name">${nameDisplay}</h4>
          ${renderStars(item.rating, ui.ratingLabels)}
        </div>
      </div>
      <p class="card-body">${item.description}</p>
      ${mustTry}
      ${note}
      <div class="card-bottom">
        ${renderTags(item.tags)}
        ${renderMapsLink(item.mapsUrl, ui.mapsLink)}
      </div>
    </article>`;
}

// ─── Section: Food ────────────────────────────────────────────

function renderFood(data, ui) {
  setHTML(
    "food-header",
    `
    <h2 class="section-title">${data.label}</h2>
    <p class="section-intro">${data.intro}</p>`,
  );

  setHTML(
    "food-body",
    `
    <div class="subsection">
      <h3 class="subsection-title">${data.restaurants.label}</h3>
      <div class="card-grid">
        ${data.restaurants.items.map((item) => restaurantCard(item, ui)).join("")}
      </div>
    </div>

    <div class="subsection">
      <h3 class="subsection-title">${data.localFood.label}</h3>
      <p class="subsection-intro">${data.localFood.intro}</p>
      <div class="food-grid">
        ${data.localFood.items.map((item) => localFoodItem(item)).join("")}
      </div>
    </div>

    <div class="subsection">
      <h3 class="subsection-title">${data.bakeries.label}</h3>
      <div class="card-grid">
        ${data.bakeries.items.map((item) => restaurantCard(item, ui)).join("")}
      </div>
    </div>`,
  );
}

function restaurantCard(item, ui) {
  const locationDetail = item.locationDetail
    ? `<span class="badge badge--note">${item.locationDetail}</span>`
    : "";

  return `
    <article class="card">
      <div class="card-top">
        <div class="card-name-row">
          <h4 class="card-name">${item.name}</h4>
          ${renderStars(item.rating, ui.ratingLabels)}
        </div>
        <div class="card-badges">
          <span class="badge badge--area">${item.location}</span>
          ${locationDetail}
        </div>
      </div>
      <p class="card-body">${item.description}</p>
      <div class="card-bottom">
        ${renderTags(item.tags)}
        ${renderMapsLink(item.mapsUrl, ui.mapsLink)}
      </div>
    </article>`;
}

function localFoodItem(item) {
  return `
    <div class="food-item">
      <div class="food-item-header">
        <h4 class="food-item-name">${item.name}</h4>
        ${renderTags(item.tags)}
      </div>
      <p class="food-item-desc">${item.description}</p>
    </div>`;
}

// ─── Section: Practical ───────────────────────────────────────

const TIP_ICONS = {
  wind: "💨",
  mountain: "⛰️",
  gift: "🎁",
  people: "🗣️",
  ferry: "⛴️",
  bus: "🚌",
  parking: "🅿️",
  water: "💧",
  shop: "🛒",
};

function renderPractical(data) {
  setHTML(
    "practical-header",
    `
    <h2 class="section-title">${data.label}</h2>
    ${data.intro ? `<p class="section-intro">${data.intro}</p>` : ""}`,
  );

  setHTML(
    "practical-body",
    `
    <div class="tips-grid">
      ${data.items.map((item) => tipCard(item)).join("")}
    </div>`,
  );
}

function tipCard(item) {
  const highlight = item.highlight
    ? `<div class="tip-card-highlight">${item.highlight}</div>`
    : "";

  return `
    <div class="tip-card">
      <div class="tip-card-icon">${TIP_ICONS[item.icon] || "📌"}</div>
      <div class="tip-card-content">
        <h4 class="tip-card-title">${item.title}</h4>
        <p class="tip-card-desc">${item.description}</p>
        ${highlight}
      </div>
    </div>`;
}

// ─── Section: Activities ──────────────────────────────────────

function renderActivities(data, ui) {
  renderTabbedSection("activities", data, ui);
}

// ─── Section: History ─────────────────────────────────────────

function renderHistory(data) {
  setHTML(
    "history-header",
    `
    <h2 class="section-title">${data.label}</h2>
    ${data.intro ? `<p class="section-intro">${data.intro}</p>` : ""}`,
  );

  setHTML(
    "history-body",
    `<div class="history-chapters">
      ${data.chapters
        .map(
          (c) => `
        <article class="history-chapter">
          <h3 class="history-chapter-title">${c.title}</h3>
          <p class="history-chapter-body">${c.body}</p>
        </article>`,
        )
        .join("")}
    </div>`,
  );
}

// ─── Tabbed Section (shared by Culture + Activities) ──────────

function renderTabbedSection(id, data, ui) {
  const tabs = data.subsections
    .map(
      (sub, i) =>
        `<button class="tab${i === 0 ? " is-active" : ""}" data-group="${id}" data-tab="${sub.id}" role="tab" aria-selected="${i === 0}">${sub.label}</button>`,
    )
    .join("");

  setHTML(
    `${id}-header`,
    `
    <h2 class="section-title">${data.label}</h2>
    ${data.intro ? `<p class="section-intro">${data.intro}</p>` : ""}
    <div class="tabs" role="tablist">${tabs}</div>`,
  );

  const panels = data.subsections
    .map((sub, i) => {
      const hasDates = sub.items.some((it) => it.month && it.day);
      const calendar = hasDates ? renderCalendar(sub.items, ui) : "";
      return `
      <div class="panel${i === 0 ? " is-active" : ""}" data-group="${id}" data-panel="${sub.id}">
        ${sub.intro ? `<p class="subsection-intro">${sub.intro}</p>` : ""}
        ${calendar}
        <div class="card-grid">
          ${sub.items.map((item) => cultureCard(item, ui)).join("")}
        </div>
      </div>`;
    })
    .join("");

  setHTML(`${id}-body`, panels);
}

// ─── Section: Culture ─────────────────────────────────────────

function renderCulture(data, ui) {
  renderTabbedSection("culture", data, ui);
}

function cultureCard(item, ui) {
  const meta = item.meta
    ? `<span class="card-meta">${item.meta}</span>`
    : "";
  const location = item.location
    ? `<span class="badge badge--area">${item.location}</span>`
    : "";
  const calKey =
    item.month && item.day ? ` data-cal-key="${item.month}-${item.day}"` : "";

  return `
    <article class="card"${calKey}>
      <div class="card-top">
        <div class="card-name-row">
          <h4 class="card-name">${item.name}</h4>
          ${meta}
        </div>
        ${location ? `<div class="card-badges">${location}</div>` : ""}
      </div>
      <p class="card-body">${item.description}</p>
      ${renderNearby(item.nearbyLinks, item.nearbyLabel || ui.nearbyLabel)}
      <div class="card-bottom">
        ${renderTags(item.tags)}
        ${renderMapsLink(item.mapsUrl, ui.mapsLink)}
      </div>
    </article>`;
}

// ─── Calendar ─────────────────────────────────────────────────

function renderCalendar(items, ui) {
  const cfg = ui.calendar;
  if (!cfg) return "";

  const dayMap = {};
  items.forEach((item) => {
    if (!item.month || !item.day) return;
    const last = item.endDay || item.day;
    for (let d = item.day; d <= last; d++) {
      dayMap[`${item.month}-${d}`] = item;
    }
  });
  if (!Object.keys(dayMap).length) return "";

  const eventMonths = [...new Set(items.filter((i) => i.month).map((i) => i.month))];
  const minMonth = Math.min(5, ...eventMonths);
  const maxMonth = Math.max(9, ...eventMonths);
  const months = [];
  for (let m = minMonth; m <= maxMonth; m++) months.push(m);

  return `<div class="calendar">${months
    .map((m) => renderMonth(cfg.year, m, dayMap, cfg))
    .join("")}</div>`;
}

function renderMonth(year, month, dayMap, cfg) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const offset = (firstDay + 6) % 7; // Mon-first

  const weekdayCells = cfg.weekdays
    .map((w) => `<div class="cal-weekday">${w}</div>`)
    .join("");

  let dayCells = "";
  for (let i = 0; i < offset; i++) {
    dayCells += `<div class="cal-day cal-day--empty"></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const item = dayMap[`${month}-${d}`];
    if (item) {
      const startKey = `${item.month}-${item.day}`;
      dayCells += `<button class="cal-day cal-day--event" data-cal-key="${startKey}" title="${item.name}" aria-label="${item.name} — ${d}">${d}</button>`;
    } else {
      dayCells += `<div class="cal-day">${d}</div>`;
    }
  }

  return `
    <div class="cal-month">
      <div class="cal-month-name">${cfg.monthsShort[month - 1]} ${year}</div>
      <div class="cal-grid">
        ${weekdayCells}
        ${dayCells}
      </div>
    </div>`;
}

// ─── Card Cross-Links ─────────────────────────────────────────

function setupCardLinks() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a.card-link[data-target]");
    if (!link) return;
    e.preventDefault();
    const targetId = link.dataset.target;
    const targetCard = document.querySelector(`[data-card-id="${targetId}"]`);
    if (!targetCard) return;

    // If card is inside a hidden tab panel, activate that tab first
    const panel = targetCard.closest(".panel");
    if (panel && !panel.classList.contains("is-active")) {
      const group = panel.dataset.group;
      const tabId = panel.dataset.panel;
      const tab = document.querySelector(
        `.tab[data-group="${group}"][data-tab="${tabId}"]`,
      );
      if (tab) tab.click();
    }

    // Scroll + pulse (small delay so the tab switch finishes first)
    setTimeout(() => {
      targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
      targetCard.classList.remove("is-pulse");
      void targetCard.offsetWidth;
      targetCard.classList.add("is-pulse");
    }, 120);
  });
}

// ─── Search Modal (placeholder) ───────────────────────────────

function setupSearchPlaceholder() {
  const overlay = $("search-overlay");
  const btn = $("nav-search");
  const closeBtn = $("search-close");
  const input = $("search-input");
  if (!overlay || !btn) return;

  const open = () => {
    overlay.removeAttribute("hidden");
    setTimeout(() => input?.focus(), 50);
  };
  const close = () => overlay.setAttribute("hidden", "");

  btn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hasAttribute("hidden")) close();
  });
}

function setupCalendarClick() {
  document.addEventListener("click", (e) => {
    const cell = e.target.closest(".cal-day--event");
    if (!cell) return;
    const key = cell.dataset.calKey;
    const card = document.querySelector(`.card[data-cal-key="${key}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("is-pulse");
    void card.offsetWidth; // restart animation
    card.classList.add("is-pulse");
  });
}

// ─── Section Tabs (generic) ───────────────────────────────────

function setupSectionTabs() {
  document.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    const group = tab.dataset.group;
    const tabId = tab.dataset.tab;
    if (!group || !tabId) return;

    document
      .querySelectorAll(`.tab[data-group="${group}"]`)
      .forEach((t) => {
        const active = t.dataset.tab === tabId;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
      });
    document
      .querySelectorAll(`.panel[data-group="${group}"]`)
      .forEach((p) => {
        p.classList.toggle("is-active", p.dataset.panel === tabId);
      });

    // Section-specific side effects
    if (group === "beaches") {
      const sub = state.data?.sections?.beaches?.subsections?.find(
        (s) => s.id === tabId,
      );
      if (sub) initBeachMap(sub.items, state.data.ui);
    }
  });
}

// ─── Beach Card → Map Zoom ────────────────────────────────────

function setupBeachCardClick() {
  const body = $("beaches-body");
  if (!body) return;
  body.addEventListener("click", (e) => {
    const card = e.target.closest("[data-beach-id]");
    if (!card || !_beachMap) return;
    const marker = _beachMarkers[card.dataset.beachId];
    if (!marker) return;
    document
      .getElementById("beach-map")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    _beachMap.flyTo(marker.getLatLng(), 14, { animate: true, duration: 0.8 });
    setTimeout(() => marker.openPopup(), 900);
  });
}

// ─── Render All ───────────────────────────────────────────────

function renderAll(data) {
  renderMeta(data.meta);
  renderNav(data.nav, data.ui);
  renderBeaches(data.sections.beaches, data.ui);
  renderDrinks(data.sections.drinks, data.ui);
  renderFood(data.sections.food, data.ui);
  renderActivities(data.sections.activities, data.ui);
  renderCulture(data.sections.culture, data.ui);
  renderHistory(data.sections.history);
  renderPractical(data.sections.practical);
}

// ─── Language Toggle ──────────────────────────────────────────

function setupLangToggle() {
  document.addEventListener("click", async (e) => {
    if (!e.target.closest(".lang-toggle")) return;
    state.lang = state.lang === "el" ? "en" : "el";
    localStorage.setItem(STORAGE_KEY, state.lang);
    state.data = await fetchContent(state.lang);
    renderAll(state.data);
  });
}

// ─── Sticky Nav ───────────────────────────────────────────────

function setupStickyNav() {
  const hero = document.querySelector(".hero");
  const nav = $("sticky-nav");
  if (!hero || !nav) return;

  const observer = new IntersectionObserver(
    ([entry]) => nav.classList.toggle("is-stuck", !entry.isIntersecting),
    { threshold: 0 },
  );
  observer.observe(hero);
}

// ─── Active Section Highlight ─────────────────────────────────

function setupActiveSection() {
  const sections = document.querySelectorAll(".section[id]");
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        document.querySelectorAll(".nav-link").forEach((link) => {
          link.classList.toggle(
            "is-active",
            link.getAttribute("href") === `#${entry.target.id}`,
          );
        });
      });
    },
    { rootMargin: "-35% 0px -55% 0px" },
  );

  sections.forEach((s) => observer.observe(s));
}

// ─── Init ─────────────────────────────────────────────────────

async function init() {
  try {
    state.data = await fetchContent(state.lang);
    renderAll(state.data);
    setupLangToggle();
    setupStickyNav();
    setupActiveSection();
    setupSectionTabs();
    setupBeachCardClick();
    setupCalendarClick();
    setupCardLinks();
    setupSearchPlaceholder();
  } catch (err) {
    document.body.innerHTML = `
      <div style="padding:2rem;font-family:sans-serif">
        <strong>Error loading content:</strong> ${err.message}<br><br>
        Make sure you are serving the site over HTTP — open via a local server, not directly as a file.<br><br>
        <code>npx serve .</code> &nbsp;or&nbsp; <code>python -m http.server 8000</code>
      </div>`;
  }
}

init();
