// Soul Storm schedule math. Runs in the browser: keep it free of imports (checked by a test).
// All times are epoch milliseconds; local time is only applied when formatting for display.

export interface StormSchedule {
  readonly anchorMs: number;
  readonly durationMs: number;
  readonly cadenceMs: number;
  readonly areaCount: number;
  readonly rotationOffset: number;
}

export interface StormWindow {
  readonly index: number;
  readonly areaIndex: number;
  readonly startMs: number;
  readonly endMs: number;
}

/** active: `window` is the running storm and msLeft counts to its end; otherwise `window` is the next one and msLeft counts to its start. */
export interface StormState {
  readonly active: boolean;
  readonly window: StormWindow;
  readonly msLeft: number;
}

export interface ClockArea {
  readonly name: string;
  readonly href: string;
}

export interface ClockLabels {
  readonly now: string;
  readonly next: string;
  readonly endsIn: string;
  readonly startsIn: string;
  readonly timeZone: string;
}

export interface ClockPayload extends StormSchedule {
  readonly areas: readonly ClockArea[];
  readonly labels: ClockLabels;
  readonly upcoming: number;
}

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** Modulo that always lands in [0, n), also for negative values. */
const mod = (value: number, n: number): number => ((value % n) + n) % n;

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** The storm with the given index; windows are half-open [startMs, endMs). */
export function windowAt(schedule: StormSchedule, index: number): StormWindow {
  const startMs = schedule.anchorMs + index * schedule.cadenceMs;
  return {
    index,
    areaIndex: mod(index + schedule.rotationOffset, schedule.areaCount),
    startMs,
    endMs: startMs + schedule.durationMs,
  };
}

/** The running storm, or the next one when none is running. */
export function stormState(schedule: StormSchedule, nowMs: number): StormState {
  const current = windowAt(schedule, Math.floor((nowMs - schedule.anchorMs) / schedule.cadenceMs));
  if (nowMs < current.endMs) return { active: true, window: current, msLeft: current.endMs - nowMs };
  const next = windowAt(schedule, current.index + 1);
  return { active: false, window: next, msLeft: next.startMs - nowMs };
}

/** `count` consecutive storms, starting with the running one (or the next one). */
export function upcomingWindows(schedule: StormSchedule, nowMs: number, count: number): StormWindow[] {
  const first = stormState(schedule, nowMs).window.index;
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, offset) => windowAt(schedule, first + offset));
}

/** Rounded up to the second: "m:ss", or "h:mm:ss" from one hour; zero or negative reads "0:00". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / MS_PER_SECOND));
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = total % SECONDS_PER_MINUTE;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`;
}

/** Weekday and 24-hour time in the viewer's zone (or the given IANA zone). */
export function formatWindowTime(ms: number, locale: string, timeZone?: string): string {
  const options: Intl.DateTimeFormatOptions = { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  return new Intl.DateTimeFormat(locale, timeZone === undefined ? options : { ...options, timeZone }).format(ms);
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isArea = (value: unknown): value is ClockArea => isRecord(value) && typeof value.name === "string" && typeof value.href === "string";

const isLabels = (value: unknown): value is ClockLabels =>
  isRecord(value) &&
  typeof value.now === "string" &&
  typeof value.next === "string" &&
  typeof value.endsIn === "string" &&
  typeof value.startsIn === "string" &&
  typeof value.timeZone === "string";

/** Validates the JSON the page embeds; anything off yields undefined rather than a throw. */
export function parseClockPayload(raw: unknown): ClockPayload | undefined {
  if (!isRecord(raw)) return undefined;
  const { anchorMs, durationMs, cadenceMs, areaCount, rotationOffset, upcoming, areas, labels } = raw;
  if (!isFiniteNumber(anchorMs) || !isFiniteNumber(durationMs) || !isFiniteNumber(cadenceMs)) return undefined;
  if (!isFiniteNumber(areaCount) || !isFiniteNumber(rotationOffset) || !isFiniteNumber(upcoming)) return undefined;
  if (areaCount < 1 || cadenceMs <= durationMs) return undefined;
  if (!Array.isArray(areas) || areas.length !== areaCount || !areas.every(isArea) || !isLabels(labels)) return undefined;
  return {
    anchorMs,
    durationMs,
    cadenceMs,
    areaCount,
    rotationOffset,
    upcoming,
    areas: areas.map((area) => ({ name: area.name, href: area.href })),
    labels: {
      now: labels.now,
      next: labels.next,
      endsIn: labels.endsIn,
      startsIn: labels.startsIn,
      timeZone: labels.timeZone,
    },
  };
}
