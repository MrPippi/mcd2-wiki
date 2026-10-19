// Only the dependency-free schedule module: every string arrives in the page's JSON payload.
import {
  formatCountdown,
  formatWindowTime,
  parseClockPayload,
  stormState,
  upcomingWindows,
  type ClockPayload,
} from "../lib/soul-storm-schedule";

const TICK_MS = 1000;
const ICON_SIZE = 28;

interface ClockParts {
  readonly status: HTMLElement;
  readonly countdown: HTMLElement;
  readonly rows: HTMLElement;
  readonly zone: HTMLElement;
}

export interface ClockText {
  readonly status: string;
  readonly countdown: string;
  readonly windowIndex: number;
}

/** The status line, the countdown and the index of the storm window they describe, at `nowMs`. */
export function clockText(payload: ClockPayload, nowMs: number): ClockText {
  const state = stormState(payload, nowMs);
  const area = payload.areas[state.window.areaIndex].name;
  return {
    status: (state.active ? payload.labels.now : payload.labels.next).replace("{area}", () => area),
    countdown: (state.active ? payload.labels.endsIn : payload.labels.startsIn).replace("{time}", () => formatCountdown(state.msLeft)),
    windowIndex: state.window.index,
  };
}

function readPayload(root: HTMLElement): ClockPayload | undefined {
  const source = root.querySelector("[data-soul-storm-json]")?.textContent ?? "";
  try {
    return parseClockPayload(JSON.parse(source));
  } catch {
    return undefined; // not JSON: reported by the caller like any other bad payload
  }
}

function partsOf(root: HTMLElement): ClockParts | undefined {
  const status = root.querySelector<HTMLElement>("[data-status]");
  const countdown = root.querySelector<HTMLElement>("[data-countdown]");
  const rows = root.querySelector<HTMLElement>("[data-upcoming]");
  const zone = root.querySelector<HTMLElement>("[data-timezone]");
  return status && countdown && rows && zone ? { status, countdown, rows, zone } : undefined;
}

function areaIcon(src: string | undefined): HTMLElement[] {
  if (!src) return [];
  const mount = document.createElement("span");
  mount.className = "location-icon";
  mount.style.setProperty("--size", `${ICON_SIZE}px`);
  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  image.width = ICON_SIZE;
  image.height = ICON_SIZE;
  mount.append(image);
  return [mount];
}

function windowRow(payload: ClockPayload, startMs: number, areaIndex: number, locale: string): HTMLTableRowElement {
  const row = document.createElement("tr");
  const when = document.createElement("td");
  const time = document.createElement("time");
  time.dateTime = new Date(startMs).toISOString();
  time.textContent = formatWindowTime(startMs, locale);
  when.append(time);
  const where = document.createElement("td");
  const link = document.createElement("a");
  const area = payload.areas[areaIndex];
  link.href = area.href;
  link.textContent = area.name;
  where.append(...areaIcon(area.icon), link);
  row.append(when, where);
  return row;
}

/** Rebuilds the table only when the storm it starts with changes. */
function renderTable(parts: ClockParts, payload: ClockPayload, nowMs: number, windowIndex: number): void {
  const key = String(windowIndex);
  if (parts.rows.dataset.window === key) return;
  const locale = document.documentElement.lang;
  const rows = upcomingWindows(payload, nowMs, payload.upcoming).map((w) => windowRow(payload, w.startMs, w.areaIndex, locale));
  parts.rows.replaceChildren(...rows);
  parts.rows.dataset.window = key;
}

function render(parts: ClockParts, payload: ClockPayload, nowMs: number): void {
  const text = clockText(payload, nowMs);
  // The live region only hears about a new state, never the ticking seconds.
  if (parts.status.textContent !== text.status) parts.status.textContent = text.status;
  parts.countdown.textContent = text.countdown;
  renderTable(parts, payload, nowMs, text.windowIndex);
}

export function mountSoulStormClock(root: HTMLElement): void {
  const payload = readPayload(root);
  const parts = partsOf(root);
  if (!payload || !parts) {
    console.error("soul storm clock: bad payload");
    return;
  }
  parts.zone.textContent = payload.labels.timeZone.replace("{zone}", () => Intl.DateTimeFormat().resolvedOptions().timeZone);
  render(parts, payload, Date.now());
  root.hidden = false;
  window.setInterval(() => render(parts, payload, Date.now()), TICK_MS);
}
