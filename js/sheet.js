/**
 * The detail sheet.
 *
 * This is the fix for the guide's oldest annoyance: tapping a place used to
 * scroll the page to the map and lose whatever you were reading. The sheet
 * opens *over* the list instead, so the list keeps its scroll position and
 * dismissing it puts you back exactly where you were.
 *
 * It is URL-backed (#/beaches/sandy/glyfo), so it is shareable and the
 * hardware back button closes it.
 */

import { state } from "./store.js";
import * as router from "./router.js";
import * as ui from "./ui.js";
import * as maps from "./map.js";

let scrim, panel, body, closeBtn, grabber;
let closeTo = null; // where to go if there is no history to pop
let canPop = false;
let lastFocus = null;

export function isOpen() {
  return scrim && !scrim.hasAttribute("hidden");
}

export function open(entry, opts = {}) {
  if (!scrim) return;
  lastFocus = document.activeElement;
  closeTo = opts.closeTo || "#/";
  canPop = !!opts.canPop;

  body.innerHTML = ui.detail(entry, opts.icon);
  scrim.removeAttribute("hidden");
  document.body.classList.add("no-scroll");
  panel.scrollTop = 0;
  panel.style.transform = "";
  requestAnimationFrame(() => panel.focus({ preventScroll: true }));

  if (entry.item.lat && entry.item.lng) {
    maps.render("detail-map", [entry], {
      focusId: entry.item.id,
      zoom: 14,
      interactive: true,
      popups: false,
    });
  }
}

export function close() {
  if (!isOpen()) return;
  maps.destroy("detail-map");
  scrim.setAttribute("hidden", "");
  document.body.classList.remove("no-scroll");
  panel.style.transform = "";

  // Prefer popping history so the back button and the ✕ agree with each other.
  if (canPop) router.back();
  else router.go(closeTo, { replace: true });

  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}

/** Hide without touching history — used when the router navigates elsewhere. */
export function dismiss() {
  if (!isOpen()) return;
  maps.destroy("detail-map");
  scrim.setAttribute("hidden", "");
  document.body.classList.remove("no-scroll");
  panel.style.transform = "";
}

export function init() {
  scrim = document.getElementById("sheet");
  panel = document.getElementById("sheet-panel");
  body = document.getElementById("sheet-body");
  closeBtn = document.getElementById("sheet-close");
  grabber = document.getElementById("sheet-grabber");
  if (!scrim) return;

  closeBtn.setAttribute("aria-label", state.ui.close);
  closeBtn.textContent = "✕";

  closeBtn.addEventListener("click", close);
  scrim.addEventListener("click", (e) => {
    if (e.target === scrim) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) close();
  });

  setupDrag();
}

/**
 * Drag the sheet down to dismiss. Bound to the grab handle only — binding it
 * to the whole panel would fight with scrolling a long description.
 */
function setupDrag() {
  let startY = 0;
  let dy = 0;
  let dragging = false;

  const start = (e) => {
    dragging = true;
    dy = 0;
    startY = e.touches[0].clientY;
    panel.style.transition = "none";
  };

  const move = (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    panel.style.transform = `translateY(${dy}px)`;
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = "";
    if (dy > 110) close();
    else panel.style.transform = "";
  };

  grabber.addEventListener("touchstart", start, { passive: true });
  grabber.addEventListener("touchmove", move, { passive: true });
  grabber.addEventListener("touchend", end);
  grabber.addEventListener("touchcancel", end);
}
