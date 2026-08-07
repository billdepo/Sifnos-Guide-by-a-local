/**
 * Leaflet maps. Two callers:
 *   · the full-screen #/map view, over every item that has coordinates
 *   · the inset map inside a detail sheet
 *
 * Maps are torn down explicitly on every re-render — Leaflet leaks listeners
 * on a container that gets innerHTML'd out from under it.
 */

import { RATING_COLORS, coloredStars } from "./ui.js";
import { state } from "./store.js";

const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIB = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const instances = new Map(); // containerId → { map, markers }

export function destroy(containerId) {
  const inst = instances.get(containerId);
  if (inst) {
    inst.map.remove();
    instances.delete(containerId);
  }
}

export function destroyAll() {
  for (const id of [...instances.keys()]) destroy(id);
}

/**
 * @param {string} containerId
 * @param {Array}  entries  normalised index entries (need item.lat/lng)
 * @param {object} opts     { focusId, zoom, interactive, onSelect }
 */
export function render(containerId, entries, opts = {}) {
  if (typeof L === "undefined") return null;
  const el = document.getElementById(containerId);
  if (!el) return null;

  destroy(containerId);

  const pts = entries.filter((e) => e.item.lat && e.item.lng);
  if (!pts.length) {
    el.style.display = "none";
    return null;
  }
  el.style.display = "";

  const map = L.map(containerId, {
    scrollWheelZoom: opts.interactive !== false,
    dragging: opts.interactive !== false,
    zoomControl: opts.interactive !== false,
    tap: true,
  });
  L.tileLayer(TILES, { attribution: ATTRIB, maxZoom: 18 }).addTo(map);

  const markers = {};
  const bounds = [];

  for (const entry of pts) {
    const { item, viewId, groupId } = entry;
    const marker = L.circleMarker([item.lat, item.lng], {
      radius: 10,
      fillColor: RATING_COLORS[item.rating] ?? "#1a4f7a",
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.92,
    }).addTo(map);

    // A single-place map inside a detail sheet needs no popup — the name and
    // rating are already on screen, and the popup just covers the map.
    if (opts.popups !== false) {
      const rating =
        item.rating === undefined || item.rating === null
          ? ""
          : `<br>${coloredStars(item.rating)} <small>${state.ui.ratingLabels[String(item.rating)]}</small>`;

      marker.bindPopup(
        `<strong>${item.name}</strong>${rating}<br><a class="popup-link" href="#/${viewId}/${groupId}/${item.id}">${state.ui.more} ›</a>`,
      );
    }
    if (opts.onSelect) marker.on("click", () => opts.onSelect(entry));

    markers[item.id] = marker;
    bounds.push([item.lat, item.lng]);
  }

  const target = opts.focusId && markers[opts.focusId];
  if (target) {
    map.setView(target.getLatLng(), opts.zoom || 14);
  } else {
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: opts.zoom || 15 });
  }

  instances.set(containerId, { map, markers });

  // Deferred work must re-check that this exact map is still mounted: closing
  // a sheet destroys it mid-animation, and Leaflet throws on a removed map.
  const alive = () => instances.get(containerId)?.map === map;
  // A map created inside a sheet that is still animating measures 0×0.
  setTimeout(() => alive() && map.invalidateSize(), 60);
  if (target) setTimeout(() => alive() && target.openPopup(), 260);

  return map;
}

export function focus(containerId, id) {
  const inst = instances.get(containerId);
  const marker = inst?.markers[id];
  if (!marker) return;
  inst.map.flyTo(marker.getLatLng(), 14, { duration: 0.7 });
  setTimeout(() => {
    if (instances.get(containerId) === inst) marker.openPopup();
  }, 750);
}

export function invalidate(containerId) {
  instances.get(containerId)?.map.invalidateSize();
}
