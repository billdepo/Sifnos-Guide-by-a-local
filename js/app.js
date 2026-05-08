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
}

// ─── Section: Beaches ─────────────────────────────────────────

function renderBeaches(data, ui) {
  setHTML(
    "beaches-header",
    `
    <h2 class="section-title">${data.label}</h2>
    <p class="section-intro">${data.intro}</p>
    <div class="tip-banner tip-banner--wind">
      <span class="tip-icon">💨</span>
      <p>${data.windTip}</p>
    </div>`,
  );

  setHTML(
    "beaches-body",
    data.subsections
      .map(
        (sub) => `
      <div class="subsection">
        <h3 class="subsection-title">${sub.label}</h3>
        ${sub.id === "sandy" ? '<div id="beach-map" class="beach-map"></div>' : ""}
        <div class="card-grid">
          ${sub.items.map((item) => beachCard(item, ui)).join("")}
        </div>
      </div>`,
      )
      .join(""),
  );

  const sandySub = data.subsections.find((s) => s.id === "sandy");
  if (sandySub) initBeachMap(sandySub.items, ui);
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

  return `
    <article class="card${item.rating === 0 ? " card--skip" : ""}${mappable ? " card--mappable" : ""}"${mappable}>
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

// ─── Section: Tips ────────────────────────────────────────────

const TIP_ICONS = {
  wind: "💨",
  mountain: "⛰️",
  gift: "🎁",
  people: "🗣️",
};

function renderTips(data) {
  setHTML("tips-header", `<h2 class="section-title">${data.label}</h2>`);

  setHTML(
    "tips-body",
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
  renderTips(data.sections.tips);
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
    setupBeachCardClick();
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
