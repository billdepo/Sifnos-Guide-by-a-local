/**
 * Hash router.
 *
 *   #/                          home
 *   #/beaches                   view, first group
 *   #/beaches/sandy             view + group
 *   #/beaches/sandy/glyfo       …and open that item's sheet
 *   #/beaches/sandy?f=must,car  …with filters applied
 *   #/search?q=vathi            search
 *   #/map                       full-screen map
 *   #/collection/must           a derived collection
 *
 * Every piece of navigable state lives in the URL, so any screen — including
 * a single beach — is linkable, shareable and survives a reload.
 */

let handler = () => {};

export function parse(hash = location.hash) {
  const raw = String(hash).replace(/^#\/?/, "");
  const [pathPart, queryPart] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(queryPart || ""));

  return {
    view: segments[0] || "home",
    group: segments[1] || null,
    item: segments[2] || null,
    query,
    filters: (query.f || "").split(",").filter(Boolean),
    path: pathPart,
  };
}

export function href(view, group, item, query) {
  let path = `#/${[view, group, item].filter(Boolean).map(encodeURIComponent).join("/")}`;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== null && v !== undefined && v !== "") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function go(to, { replace = false } = {}) {
  if (location.hash === to) return;
  if (replace) history.replaceState(history.state, "", to);
  else history.pushState({ depth: (history.state?.depth || 0) + 1 }, "", to);
  handler(parse());
}

export function depth() {
  return history.state?.depth || 0;
}

export function back() {
  history.back();
}

export function start(cb) {
  handler = cb;
  addEventListener("hashchange", () => cb(parse()));
  addEventListener("popstate", () => cb(parse()));

  // Intercept in-app links so navigation always runs through go() and the
  // history depth counter stays accurate (the sheet uses it to decide
  // whether closing should be a back() or a replace()).
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    go(a.getAttribute("href"), { replace: a.dataset.replace === "true" });
  });

  cb(parse());
}
