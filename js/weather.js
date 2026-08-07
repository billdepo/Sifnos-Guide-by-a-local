/**
 * Live weather from Open-Meteo (free, keyless, CORS-friendly).
 * Coordinates are Apollonia, the centre of the island.
 */

import { state } from "./store.js";

const URL =
  "https://api.open-meteo.com/v1/forecast?latitude=36.977&longitude=24.713" +
  "&current=temperature_2m,wind_speed_10m,wind_direction_10m" +
  "&daily=temperature_2m_max,wind_speed_10m_max,wind_direction_10m_dominant" +
  "&wind_speed_unit=kn&timezone=Europe%2FAthens&forecast_days=7";

const TTL = 10 * 60 * 1000;
let cache = null; // { ts, data }
let inflight = null;

export function knotsToBeaufort(kn) {
  const limits = [1, 3, 6, 10, 16, 21, 27, 33, 40, 47, 55, 63];
  for (let i = 0; i < limits.length; i++) if (kn <= limits[i]) return i;
  return 12;
}

export function compassIndex(deg) {
  return ((Math.round(deg / 45) % 8) + 8) % 8;
}

export async function getWeather() {
  if (cache && Date.now() - cache.ts < TTL) return cache.data;
  if (inflight) return inflight;

  inflight = fetch(URL)
    .then((r) => {
      if (!r.ok) throw new Error("weather fetch failed");
      return r.json();
    })
    .then((data) => {
      cache = { ts: Date.now(), data };
      inflight = null;
      return data;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });

  return inflight;
}

/** Compact summary the rest of the app reasons about (filters, hints). */
export function summarise(data) {
  const cur = data.current;
  const bft = knotsToBeaufort(cur.wind_speed_10m);
  const dir = cur.wind_direction_10m;
  return {
    temp: Math.round(cur.temperature_2m),
    bft,
    dir,
    compass: compassIndex(dir),
    // "Northerly" spans NW→NE: that is the meltemi, and the reason half the
    // island's beaches are unusable on a given day.
    northerly: dir >= 300 || dir <= 60,
    windy: bft >= 5,
  };
}

function hintFor(s, w) {
  if (s.windy && s.northerly) return { text: w.hintStrongNorth, cls: "is-strong", icon: "💡" };
  if (s.windy) return { text: w.hintStrong, cls: "is-strong", icon: "💡" };
  return { text: w.hintCalm, cls: "is-calm", icon: "🏖️" };
}

/** The "now" strip used on the home screen. */
export function nowHTML(data) {
  const w = state.ui.weather;
  const s = summarise(data);
  const hint = hintFor(s, w);
  const arrow = (s.dir + 180) % 360; // the direction the wind blows toward

  return `<div class="wx-now">
      <span class="wx-temp">${s.temp}°C</span>
      <span class="wx-wind">
        <span class="wx-arrow" style="transform:rotate(${arrow}deg)" aria-hidden="true">↑</span>
        <span><strong>${s.bft} ${w.beaufort}</strong> · ${w.directions[s.compass]}</span>
      </span>
    </div>
    <div class="wx-hint ${hint.cls}">
      <span class="wx-hint-icon" aria-hidden="true">${hint.icon}</span>
      <span><span class="wx-hint-label">${w.hintLabel}</span>${hint.text}</span>
    </div>`;
}

/** Seven-day outlook, used inside the Practical card. */
export function forecastHTML(data) {
  const w = state.ui.weather;
  const wk = state.ui.calendar?.weekdays || [];

  const days = data.daily.time
    .map((iso, i) => {
      const d = new Date(iso);
      const bft = knotsToBeaufort(data.daily.wind_speed_10m_max[i]);
      const dir = data.daily.wind_direction_10m_dominant[i];
      return `<div class="wf-day">
        <span class="wf-head">${wk[(d.getDay() + 6) % 7] || ""} · ${d.getDate()}/${d.getMonth() + 1}</span>
        <span class="wf-temp">${Math.round(data.daily.temperature_2m_max[i])}°C</span>
        <span class="wf-wind">${bft} ${w.beaufort}</span>
        <span class="wf-dir"><span class="wf-arrow" style="transform:rotate(${(dir + 180) % 360}deg)" aria-hidden="true">↑</span>${w.directions[compassIndex(dir)]}</span>
      </div>`;
    })
    .join("");

  return `${nowHTML(data)}<div class="wx-forecast">${days}</div><div class="wx-source">${w.source}</div>`;
}

/**
 * Fill every `[data-weather]` slot currently in the DOM.
 * `variant` picks the short (home) or full (practical) rendering.
 */
export async function fillSlots() {
  const nodes = document.querySelectorAll("[data-weather]");
  if (!nodes.length) return null;
  const w = state.ui.weather;

  let data;
  try {
    data = await getWeather();
  } catch {
    nodes.forEach((n) => (n.innerHTML = `<div class="wx-error">${w.error}</div>`));
    return null;
  }

  nodes.forEach((n) => {
    n.innerHTML = n.dataset.weather === "full" ? forecastHTML(data) : nowHTML(data);
  });
  return summarise(data);
}
