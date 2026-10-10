/** The map page's client: Leaflet in CRS.Simple over the tile pyramid, plus the filter and search panel. */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapMarker, WorldMap } from "../../../scripts/extract/map-schema";
import type { Lang } from "../i18n";
import { MARKER_KINDS, type MarkerKind } from "./kinds";
import { pinElement, popupElement, resultElement } from "./marker-dom";
import { countByKind, parseHiddenKinds, searchMarkers, serializeHiddenKinds, withKind } from "./markers";
import { tileUrlTemplate } from "./tiles";
import { formatView, parseView, parseWorld, worldSearch } from "./view-state";
import { TILE } from "./worlds";
import { fillZoom } from "./zoom";

const STORAGE_KEY = "mcd2-map-hidden";
/** Area names show from this many levels below the top zoom. */
const LABEL_LEVELS = 3;
/** Search results open no further out than one level below the top zoom. */
const FOCUS_LEVELS = 1;
const PIN_SIZE: L.PointTuple = [16, 16];
const ICON_PIN_SIZE: L.PointTuple = [28, 28];
const POPUP_OPTIONS: L.PopupOptions = { minWidth: 200, maxWidth: 280 };

interface Payload {
  readonly worlds: readonly WorldMap[];
  readonly labels: Readonly<Record<MarkerKind, string>>;
}

interface Shown {
  readonly world: WorldMap;
  readonly map: L.Map;
  readonly layers: ReadonlyMap<MarkerKind, L.LayerGroup>;
  readonly pins: ReadonlyMap<string, L.Marker>;
}

/** A pixel on the full-size render as a LatLng: CRS.Simple maps one unit to 2^z pixels. */
const toLatLng = (world: WorldMap, px: number, py: number): L.LatLng => L.latLng(-py / 2 ** world.zMax, px / 2 ** world.zMax);

function readHidden(): Set<MarkerKind> {
  try {
    return parseHiddenKinds(localStorage.getItem(STORAGE_KEY));
  } catch {
    return new Set();
  }
}

function writeHidden(hidden: ReadonlySet<MarkerKind>): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeHiddenKinds(hidden));
  } catch {
    // Storage unavailable: the choice lasts for this page view only.
  }
}

function replaceLocation(search: string, hash: string): void {
  if (search === location.search && hash === location.hash) return;
  try {
    history.replaceState(history.state, "", `${location.pathname}${search}${hash}`);
  } catch {
    // Browsers may throttle or refuse replaceState (Safari); a failed write must not break Leaflet's moveend handler.
    return;
  }
  window.dispatchEvent(new Event("mcd2:locationchange"));
}

function pinSize(marker: WorldMap["markers"][number]): L.PointTuple {
  if (marker.kind === "area") return [0, 0];
  return marker.icon ? ICON_PIN_SIZE : PIN_SIZE;
}

function addPins(map: L.Map, world: WorldMap, lang: Lang, labels: Payload["labels"], hidden: ReadonlySet<MarkerKind>) {
  const layers = new Map(MARKER_KINDS.map((kind) => [kind, L.layerGroup()] as const));
  const pins = new Map<string, L.Marker>();
  for (const marker of world.markers) {
    const icon = L.divIcon({
      className: `map-marker map-marker--${marker.kind}`,
      html: pinElement(marker, lang),
      iconSize: pinSize(marker),
    });
    // Area labels sit on top of the teleport-statue pins: they stay inert so clicks reach the pin beneath.
    const isArea = marker.kind === "area";
    const pin = L.marker(toLatLng(world, marker.px, marker.py), { icon, title: marker.name[lang], keyboard: !isArea, interactive: !isArea });
    if (!isArea) pin.bindPopup(popupElement(marker, lang, labels[marker.kind]), POPUP_OPTIONS);
    layers.get(marker.kind)?.addLayer(pin);
    pins.set(marker.id, pin);
  }
  for (const [kind, layer] of layers) if (!hidden.has(kind)) layer.addTo(map);
  return { layers, pins };
}

/** Keep the zoom floor at the level where the render still fills the panel, so zooming out never shows empty space. */
function limitZoomOut(map: L.Map, world: WorldMap): void {
  const apply = () => {
    const { x, y } = map.getSize();
    map.setMinZoom(fillZoom({ width: x, height: y }, world.frame.imageSize, world.zMax));
  };
  map.on("resize", apply);
  apply();
}

function trackView(root: HTMLElement, map: L.Map, world: WorldMap): void {
  const update = () => {
    const zoom = map.getZoom();
    const centre = map.project(map.getCenter(), world.zMax);
    root.dataset.zoom = String(zoom);
    root.dataset.labels = zoom >= world.zMax - LABEL_LEVELS ? "on" : "off";
    replaceLocation(location.search, formatView({ z: zoom, px: centre.x, py: centre.y }));
  };
  map.on("moveend", update);
  update();
}

function showWorld(root: HTMLElement, canvas: HTMLElement, world: WorldMap, payload: Payload, hidden: ReadonlySet<MarkerKind>, useHash: boolean): Shown {
  const lang = root.dataset.lang as Lang;
  const size = world.frame.imageSize;
  const bounds = L.latLngBounds(toLatLng(world, 0, size), toLatLng(world, size, 0));
  const map = L.map(canvas, { crs: L.CRS.Simple, minZoom: 0, maxZoom: world.zMax, zoomSnap: 1, maxBounds: bounds, maxBoundsViscosity: 1, attributionControl: false });
  limitZoomOut(map, world);
  L.tileLayer(tileUrlTemplate(import.meta.env.BASE_URL, world.key), { tileSize: TILE, maxNativeZoom: world.zMax, maxZoom: world.zMax, noWrap: true, bounds }).addTo(map);
  const { layers, pins } = addPins(map, world, lang, payload.labels, hidden);
  const view = useHash ? parseView(location.hash, { zMin: map.getMinZoom(), zMax: world.zMax, imageSize: size }) : undefined;
  if (view) map.setView(toLatLng(world, view.px, view.py), view.z, { animate: false });
  else if (world.markers.length > 0) map.fitBounds(L.latLngBounds(world.markers.map((m) => toLatLng(world, m.px, m.py))).pad(0.1), { animate: false });
  else map.fitBounds(bounds, { animate: false });
  trackView(root, map, world);
  root.dataset.world = world.key;
  return { world, map, layers, pins };
}

function syncPanel(root: HTMLElement, world: WorldMap, hidden: ReadonlySet<MarkerKind>): void {
  const counts = countByKind(world.markers);
  for (const link of root.querySelectorAll<HTMLAnchorElement>(".map-tabs a[data-world]")) {
    if (link.dataset.world === world.key) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  for (const kind of MARKER_KINDS) {
    const count = root.querySelector(`[data-count="${kind}"]`);
    if (count) count.textContent = String(counts[kind]);
    const box = root.querySelector<HTMLInputElement>(`input[name="kind"][value="${kind}"]`);
    if (box) box.checked = !hidden.has(kind);
  }
}

function renderResults(root: HTMLElement, shown: Shown, labels: Payload["labels"], query: string, focus: (marker: MapMarker) => void): void {
  const lang = root.dataset.lang as Lang;
  const list = root.querySelector<HTMLUListElement>("[data-testid='map-results']");
  const empty = root.querySelector<HTMLElement>("[data-testid='map-empty']");
  if (!list || !empty) return;
  const found = searchMarkers(shown.world.markers, query);
  list.replaceChildren(...found.map((marker) => resultElement(marker, lang, labels[marker.kind])));
  empty.hidden = query.trim() === "" || found.length > 0;
  for (const button of list.querySelectorAll<HTMLButtonElement>("button[data-marker-id]")) {
    const marker = found.find((m) => m.id === button.dataset.markerId);
    if (marker) button.addEventListener("click", () => focus(marker));
  }
}

function bindFilters(root: HTMLElement, onChange: (kind: MarkerKind, visible: boolean) => void): void {
  for (const box of root.querySelectorAll<HTMLInputElement>("input[name='kind']")) {
    box.addEventListener("change", () => onChange(box.value as MarkerKind, box.checked));
  }
}

function bindTabs(root: HTMLElement, payload: Payload, onSwitch: (next: WorldMap) => void): void {
  for (const link of root.querySelectorAll<HTMLAnchorElement>(".map-tabs a[data-world]")) {
    link.addEventListener("click", (event) => {
      const next = payload.worlds.find((world) => world.key === link.dataset.world);
      if (!next) return;
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onSwitch(next);
    });
  }
}

/** Pasting a shared link into the same tab only changes the hash: follow it. Our own replaceState never fires this. */
function bindHash(getShown: () => Shown): void {
  window.addEventListener("hashchange", () => {
    const { world, map } = getShown();
    const view = parseView(location.hash, { zMin: map.getMinZoom(), zMax: world.zMax, imageSize: world.frame.imageSize });
    if (view) map.setView(toLatLng(world, view.px, view.py), view.z, { animate: false });
  });
}

export function mountWorldMap(root: HTMLElement): void {
  const payload = JSON.parse(root.querySelector("[data-map-json]")?.textContent ?? "{}") as Payload;
  const canvas = root.querySelector<HTMLElement>("[data-map-canvas]");
  const keys = (payload.worlds ?? []).map((world) => world.key);
  const initial = payload.worlds?.find((world) => world.key === parseWorld(location.search, keys));
  const requested = new URLSearchParams(location.search).get("world");
  const search = root.querySelector<HTMLInputElement>("[data-testid='map-search']");
  if (!canvas || !initial) return;
  let hidden = readHidden();
  let shown: Shown;
  try {
    shown = showWorld(root, canvas, initial, payload, hidden, true);
  } catch (error) {
    console.error("World map failed to start", error);
    return;
  }
  if (requested !== null && requested !== initial.key) replaceLocation(worldSearch(location.search, initial.key), location.hash);
  syncPanel(root, shown.world, hidden);
  root.dataset.ready = "true";

  const setKind = (kind: MarkerKind, visible: boolean) => {
    hidden = withKind(hidden, kind, visible);
    writeHidden(hidden);
    const layer = shown.layers.get(kind);
    if (layer && visible) layer.addTo(shown.map);
    if (layer && !visible) layer.remove();
    syncPanel(root, shown.world, hidden);
  };

  const focus = (marker: MapMarker) => {
    if (hidden.has(marker.kind)) setKind(marker.kind, true);
    const zoom = Math.max(shown.map.getZoom(), shown.world.zMax - FOCUS_LEVELS);
    shown.map.setView(toLatLng(shown.world, marker.px, marker.py), zoom);
    shown.pins.get(marker.id)?.openPopup();
  };

  const switchWorld = (next: WorldMap) => {
    if (next.key === shown.world.key) return;
    shown.map.remove();
    replaceLocation(worldSearch(location.search, next.key), "");
    shown = showWorld(root, canvas, next, payload, hidden, false);
    syncPanel(root, shown.world, hidden);
    if (search) search.value = "";
    renderResults(root, shown, payload.labels, "", focus);
  };

  bindFilters(root, setKind);
  bindTabs(root, payload, switchWorld);
  bindHash(() => shown);
  search?.addEventListener("input", () => renderResults(root, shown, payload.labels, search.value, focus));
}
