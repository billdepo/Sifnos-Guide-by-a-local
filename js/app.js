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
let _revealObserver = null;

// Marker colors per rating — medal metaphor (shared by map markers, legend, popups)
const RATING_COLORS = {
  3: "#D6A400", // gold — must visit
  2: "#9AA6B2", // silver — recommended
  1: "#C17A3C", // bronze — worth a visit
  0: "#6B7280", // slate grey — skip
};

// Colored star rating (filled/empty stars, or ✗ for 0) in the marker color.
// Shared by the map legend and the marker popups.
function coloredStars(rating, color) {
  if (rating === 0) {
    return `<span class="legend-stars" style="color:${color}">✗</span>`;
  }
  const filled = "★".repeat(rating);
  const empty = "★".repeat(3 - rating);
  return `<span class="legend-stars" style="color:${color}">${filled}<span class="legend-stars-empty">${empty}</span></span>`;
}

// ─── DOM Helpers ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function setHTML(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

// ─── Data ─────────────────────────────────────────────────────
async function fetchContent(lang) {
  // no-cache: always revalidate with the server so content updates
  // show up without a hard refresh
  const res = await fetch(`content/${lang}.json`, { cache: "no-cache" });
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

// tel: href from a display phone number (Greek numbers get +30)
function telHref(phone) {
  const digits = String(phone).replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+30${digits}`;
}

function renderContacts(contacts, label) {
  if (!contacts || !contacts.length) return "";
  const rows = contacts
    .map((c) => {
      const name = c.url
        ? `<a class="contact-name" href="${c.url}" target="_blank" rel="noopener noreferrer">${c.name}<span class="nearby-arrow">↗</span></a>`
        : `<span class="contact-name">${c.name}</span>`;
      const note = c.note ? `<span class="contact-note">${c.note}</span>` : "";
      const phone = c.phone
        ? `<a class="contact-phone" href="tel:${telHref(c.phone)}">📞 ${c.phone}</a>`
        : "";
      return `<li class="contact-row">${name}${note}${phone}</li>`;
    })
    .join("");
  return `
    <details class="card-contacts">
      <summary>ℹ️ ${label}</summary>
      <ul class="contact-list">${rows}</ul>
    </details>`;
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
  // Compact mobile nav bar + drawer header show the island name
  setHTML("nav-title", meta.title);
  setHTML("nav-drawer-title", meta.title);

  if (meta.heroImageUrl) {
    document.querySelector(".hero").style.backgroundImage =
      `linear-gradient(180deg, rgba(10,30,60,0.52) 0%, rgba(10,30,60,0.70) 100%), url('${meta.heroImageUrl}')`;
    document.querySelector(".hero").style.backgroundSize = "cover";
    document.querySelector(".hero").style.backgroundPosition = "50% 54%";
  }
}

function renderNav(nav, ui) {
  const entries = Object.entries(nav);
  setHTML(
    "nav-links",
    entries
      .map(
        ([id, label]) =>
          `<a class="nav-link" href="#${id}" role="listitem">${label}</a>`,
      )
      .join(""),
  );
  // Mobile drawer gets the same links (kept in sync for active-highlighting)
  setHTML(
    "nav-drawer-links",
    entries
      .map(
        ([id, label]) =>
          `<a class="nav-link nav-drawer-link" href="#${id}">${label}</a>`,
      )
      .join(""),
  );

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
    ${renderWeatherWidget()}
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

  setHTML(
    "beaches-body",
    `<div id="beach-map" class="beach-map"></div>${renderMapLegend(ui)}${panels}`,
  );

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
      ${renderContacts(item.contacts, ui.contactsLabel)}
      <div class="card-bottom">
        ${renderTags(item.tags)}
        ${renderMapsLink(item.mapsUrl, ui.mapsLink)}
      </div>
    </article>`;
}

function renderMapLegend(ui) {
  const items = ["3", "2", "1", "0"]
    .map((r) => {
      const stars = coloredStars(Number(r), RATING_COLORS[r]);
      return `<span class="legend-item">${stars}<span class="legend-label">${ui.ratingLabels[r]}</span></span>`;
    })
    .join("");
  return `<div class="map-legend">${items}</div>`;
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
  const legend = document.querySelector("#beaches-body .map-legend");
  if (legend) legend.style.display = mapped.length ? "" : "none";
  if (!mapped.length) return;

  _beachMap = L.map("beach-map");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(_beachMap);

  const bounds = [];

  mapped.forEach((item) => {
    const marker = L.circleMarker([item.lat, item.lng], {
      radius: 10,
      fillColor: RATING_COLORS[item.rating] || "#888",
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(_beachMap);

    const label = ui.ratingLabels[String(item.rating)] || "";
    const stars = coloredStars(item.rating, RATING_COLORS[item.rating] || "#888");
    const mapsLink = item.mapsUrl
      ? `<br><a href="${item.mapsUrl}" target="_blank" rel="noopener">↗ Google Maps</a>`
      : "";
    marker.bindPopup(
      `<strong>${item.name}</strong><br>${stars} <small>${label}</small>${mapsLink}`,
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
      ${renderContacts(item.contacts, ui.contactsLabel)}
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
    </div>
    ${
      data.localProducts
        ? `<div class="subsection">
      <h3 class="subsection-title">${data.localProducts.label}</h3>
      ${data.localProducts.intro ? `<p class="subsection-intro">${data.localProducts.intro}</p>` : ""}
      <div class="food-grid">
        ${data.localProducts.items.map((item) => localFoodItem(item)).join("")}
      </div>
    </div>`
        : ""
    }`,
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
      ${renderContacts(item.contacts, ui.contactsLabel)}
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
        ${item.widget === "weather" ? renderWeatherWidget({ collapsible: true }) : ""}
        ${
          item.embed || item.download
            ? `<div class="tip-actions">${renderEmbed(item.embed)}${renderDownload(item.download)}</div>`
            : ""
        }
      </div>
    </div>`;
}

// Collapsible inline iframe (e.g. bus timetables). The iframe src is
// set lazily on first open — see setupLazyEmbeds().
function renderEmbed(embed) {
  if (!embed || !embed.url) return "";
  return `
    <details class="card-embed">
      <summary>${embed.label}</summary>
      <div class="embed-frame">
        <iframe data-src="${embed.url}" loading="lazy" title="${embed.label}"></iframe>
      </div>
      ${embed.note ? `<p class="embed-note">${embed.note}</p>` : ""}
    </details>`;
}

// Download button (same-origin file → real download). Icon-only, label as tooltip/aria.
function renderDownload(dl) {
  if (!dl || !dl.url) return "";
  return `<a class="download-btn" href="${dl.url}" download aria-label="${dl.label}" title="${dl.label}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  </a>`;
}

function setupLazyEmbeds() {
  // "toggle" doesn't bubble — listen in the capture phase so one
  // listener covers all embeds, including re-rendered ones
  document.addEventListener(
    "toggle",
    (e) => {
      const details = e.target;
      if (!details.classList || !details.classList.contains("card-embed")) return;
      if (!details.open) return;
      const iframe = details.querySelector("iframe[data-src]");
      if (iframe) {
        iframe.src = iframe.dataset.src;
        iframe.removeAttribute("data-src");
      }
    },
    true,
  );
}

// ─── Section: Activities ──────────────────────────────────────

function renderActivities(data, ui) {
  renderTabbedSection("activities", data, ui);
}

// ─── Section: Villages ────────────────────────────────────────

function renderVillages(data, ui) {
  if (!data) return;
  setHTML(
    "villages-header",
    `
    <h2 class="section-title">${data.label}</h2>
    ${data.intro ? `<p class="section-intro">${data.intro}</p>` : ""}`,
  );

  setHTML(
    "villages-body",
    `<div class="card-grid">
      ${data.items.map((item) => villageCard(item, ui)).join("")}
    </div>`,
  );
}

function villageCard(item, ui) {
  const meta = item.meta ? `<span class="card-meta">${item.meta}</span>` : "";
  return `
    <article class="card">
      <div class="card-top">
        <div class="card-name-row">
          <h4 class="card-name">${item.name}</h4>
          ${meta}
        </div>
      </div>
      <p class="card-body">${item.description}</p>
      ${renderNearby(item.nearbyLinks, item.nearbyLabel || ui.nearbyLabel)}
      <div class="card-bottom">
        ${renderTags(item.tags)}
        ${renderMapsLink(item.mapsUrl, ui.mapsLink)}
      </div>
    </article>`;
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
    `<div class="timeline">
      ${data.chapters
        .map(
          (c) => `
        <article class="timeline-item">
          ${c.era ? `<span class="timeline-era">${c.era}</span>` : ""}
          <h3 class="timeline-title">${c.title}</h3>
          <p class="timeline-body">${c.body}</p>
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
        ${renderEmbed(sub.embed)}
        <div class="card-grid">
          ${(sub.items || []).map((item) => cultureCard(item, ui)).join("")}
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
      ${renderContacts(item.contacts, ui.contactsLabel)}
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

// ─── Mobile Nav Drawer ────────────────────────────────────────

function setupNavDrawer() {
  const overlay = $("nav-drawer");
  const toggle = $("nav-toggle");
  const closeBtn = $("nav-drawer-close");
  if (!overlay || !toggle) return;

  const open = () => {
    overlay.removeAttribute("hidden");
    document.body.classList.add("no-scroll");
    toggle.setAttribute("aria-expanded", "true");
  };
  const close = () => {
    overlay.setAttribute("hidden", "");
    document.body.classList.remove("no-scroll");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    // Close when tapping the dimmed backdrop, a section link, or a
    // drawer action (coffee / contact / language)
    if (
      e.target === overlay ||
      e.target.closest(".nav-drawer-link") ||
      e.target.closest(".nav-drawer-actions a") ||
      e.target.closest(".lang-toggle")
    ) {
      close();
    }
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

// ─── Weather Widget (Open-Meteo) ──────────────────────────────

// Apollonia, centre of the island. Wind in knots → Beaufort.
const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=36.977&longitude=24.713" +
  "&current=temperature_2m,wind_speed_10m,wind_direction_10m" +
  "&daily=temperature_2m_max,wind_speed_10m_max,wind_direction_10m_dominant" +
  "&wind_speed_unit=kn&timezone=Europe%2FAthens&forecast_days=7";

let _weatherCache = null; // { ts, data }

function knotsToBeaufort(kn) {
  const limits = [1, 3, 6, 10, 16, 21, 27, 33, 40, 47, 55, 63];
  for (let i = 0; i < limits.length; i++) if (kn <= limits[i]) return i;
  return 12;
}

function compassIndex(deg) {
  return ((Math.round(deg / 45) % 8) + 8) % 8;
}

// Placeholder container; filled by setupWeather() after fetch.
// Pass { collapsible: true } to wrap it in a closed <details> (e.g. in the tip card).
function renderWeatherWidget(opts) {
  const w = state.data?.ui?.weather;
  if (!w) return "";
  const inner = `<div class="weather-widget" data-weather><div class="weather-loading">${w.loading}</div></div>`;
  if (opts && opts.collapsible) {
    return `<details class="card-embed weather-collapsible"><summary>💨 ${w.toggleLabel}</summary>${inner}</details>`;
  }
  return inner;
}

function weatherHTML(data, w, ui) {
  const cur = data.current;
  const temp = Math.round(cur.temperature_2m);
  const bft = knotsToBeaufort(cur.wind_speed_10m);
  const dir = cur.wind_direction_10m;
  const comp = w.directions[compassIndex(dir)];
  const arrow = (dir + 180) % 360; // direction the wind blows TOWARD

  const northerly = dir >= 300 || dir <= 60;
  let hint = w.hintCalm;
  let hintClass = "is-calm";
  let hintIcon = "🏖️";
  if (bft >= 5 && northerly) {
    hint = w.hintStrongNorth;
    hintClass = "is-strong";
    hintIcon = "💡";
  } else if (bft >= 5) {
    hint = w.hintStrong;
    hintClass = "is-strong";
    hintIcon = "💡";
  }

  const wk = ui.calendar?.weekdays || [];
  const days = data.daily.time
    .map((iso, i) => {
      const d = new Date(iso);
      const idx = (d.getDay() + 6) % 7;
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
      const dbft = knotsToBeaufort(data.daily.wind_speed_10m_max[i]);
      const dtemp = Math.round(data.daily.temperature_2m_max[i]);
      const ddir = data.daily.wind_direction_10m_dominant[i];
      const dcomp = w.directions[compassIndex(ddir)];
      const darrow = (ddir + 180) % 360;
      return `<div class="wf-day">
        <span class="wf-head">${wk[idx] || ""} · ${dateStr}</span>
        <span class="wf-temp">${dtemp}°C</span>
        <span class="wf-wind">${dbft} ${w.beaufort}</span>
        <span class="wf-dir"><span class="wf-arrow" style="transform:rotate(${darrow}deg)" aria-hidden="true">↑</span>${dcomp}</span>
      </div>`;
    })
    .join("");

  return `
    <div class="weather-head"><span class="weather-title">${w.title}</span></div>
    <div class="weather-now">
      <span class="weather-temp">${temp}°C</span>
      <span class="weather-wind">
        <span class="weather-arrow" style="transform:rotate(${arrow}deg)" aria-hidden="true">↑</span>
        <span><strong>${bft} ${w.beaufort}</strong> · ${comp}</span>
      </span>
    </div>
    <div class="weather-hint ${hintClass}">
      <span class="weather-hint-icon" aria-hidden="true">${hintIcon}</span>
      <span class="weather-hint-text"><span class="weather-hint-label">${w.hintLabel}</span>${hint}</span>
    </div>
    <div class="weather-forecast">${days}</div>
    <div class="weather-source">${w.source}</div>`;
}

async function setupWeather(ui) {
  const nodes = document.querySelectorAll("[data-weather]");
  if (!nodes.length) return;
  const w = ui.weather;
  if (!w) return;

  let data;
  try {
    if (_weatherCache && Date.now() - _weatherCache.ts < 600000) {
      data = _weatherCache.data;
    } else {
      const res = await fetch(WEATHER_URL);
      if (!res.ok) throw new Error("weather fetch failed");
      data = await res.json();
      _weatherCache = { ts: Date.now(), data };
    }
  } catch (err) {
    nodes.forEach((n) => {
      n.innerHTML = `<div class="weather-error">${w.error}</div>`;
    });
    return;
  }

  const html = weatherHTML(data, w, ui);
  nodes.forEach((n) => {
    n.innerHTML = html;
  });
}

// ─── Render All ───────────────────────────────────────────────

function renderAll(data) {
  renderMeta(data.meta);
  renderNav(data.nav, data.ui);
  renderBeaches(data.sections.beaches, data.ui);
  renderVillages(data.sections.villages, data.ui);
  renderDrinks(data.sections.drinks, data.ui);
  renderFood(data.sections.food, data.ui);
  renderActivities(data.sections.activities, data.ui);
  renderCulture(data.sections.culture, data.ui);
  renderHistory(data.sections.history);
  renderPractical(data.sections.practical);
  setupReveal();
  setupWeather(data.ui);
}

// ─── Scroll Reveal ────────────────────────────────────────────

function setupReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  if (_revealObserver) _revealObserver.disconnect();
  _revealObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("is-visible");
        obs.unobserve(el);
        // Once revealed, drop the helper classes + stagger delay so they
        // don't interfere with the card's own hover transitions
        setTimeout(() => {
          el.classList.remove("reveal", "is-visible");
          el.style.transitionDelay = "";
        }, 900);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
  );

  document
    .querySelectorAll(".card, .tip-card, .food-item, .timeline-item")
    .forEach((el) => {
      el.classList.add("reveal");
      // Small stagger within a grid row
      const idx = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.transitionDelay = `${(idx % 3) * 60}ms`;
      _revealObserver.observe(el);
    });
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
    setupNavDrawer();
    setupLazyEmbeds();
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
