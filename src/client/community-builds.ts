/** The community builds page in the browser: the list, its sort and paging, likes and reports. */
import { cardItems, type ItemIndex } from "../lib/community/cards";
import type { CommunityListPayload } from "../lib/community/payload";
import { hasMark, listBuilds, markBuild, saveMark, type CommunityBuild } from "./community-api";
import { turnstileToken } from "./turnstile";

type Sort = "top" | "new";
const ICON_SIZE = 40;

interface ListParts {
  readonly list: HTMLElement;
  readonly status: HTMLElement;
  readonly more: HTMLButtonElement;
  readonly turnstile: HTMLElement;
  readonly sorts: readonly HTMLButtonElement[];
}

interface ListState {
  readonly payload: CommunityListPayload;
  readonly parts: ListParts;
  sort: Sort;
  page: number;
  /** Bumped on every reload, so a slow answer for an old sort is dropped. */
  request: number;
}

function readPayload(root: HTMLElement): CommunityListPayload | undefined {
  try {
    const value = JSON.parse(root.querySelector("[data-community-json]")?.textContent ?? "") as CommunityListPayload;
    return typeof value.api === "string" && typeof value.siteKey === "string" && typeof value.labels === "object" && typeof value.items === "object" ? value : undefined;
  } catch {
    return undefined; // not JSON: the caller reports it like any other bad payload
  }
}

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

function itemStrip(code: string, items: ItemIndex): HTMLElement {
  const strip = make("ul", "community-items");
  strip.setAttribute("role", "list");
  for (const item of cardItems(code, items)) {
    const cell = make("li", "community-item");
    cell.dataset.slot = item.slot;
    if (item.icon) {
      const image = document.createElement("img");
      image.src = item.icon;
      image.alt = item.name;
      image.title = item.name;
      image.width = ICON_SIZE;
      image.height = ICON_SIZE;
      image.loading = "lazy";
      cell.append(image);
    } else {
      cell.append(make("span", "community-item-name", item.name));
    }
    strip.append(cell);
  }
  return strip;
}

const likeText = (state: ListState, liked: boolean, votes: number): string => `${liked ? state.payload.labels.liked : state.payload.labels.like} · ${votes}`;

/** Sends a like or report with a fresh Turnstile token; the new like count, or undefined after saying what went wrong. */
async function act(state: ListState, build: CommunityBuild, action: "vote" | "report", button: HTMLButtonElement): Promise<number | undefined> {
  const { payload, parts } = state;
  button.disabled = true;
  try {
    const token = await turnstileToken(payload.siteKey, parts.turnstile, payload.locale);
    const result = await markBuild(payload.api, build.id, action, token);
    if (!result.ok) {
      parts.status.textContent = payload.labels[result.label];
      return undefined;
    }
    saveMark(build.id, action);
    return result.value.votes;
  } catch (error) {
    console.error("community builds:", error);
    parts.status.textContent = payload.labels.errVerify;
    return undefined;
  } finally {
    button.disabled = false;
  }
}

function likeButton(state: ListState, build: CommunityBuild): HTMLButtonElement {
  const button = make("button", "community-like");
  button.type = "button";
  button.dataset.like = "";
  const liked = hasMark(build.id, "vote");
  button.setAttribute("aria-pressed", String(liked));
  button.textContent = likeText(state, liked, build.votes);
  button.addEventListener("click", async () => {
    if (button.getAttribute("aria-pressed") === "true") return;
    const votes = await act(state, build, "vote", button);
    if (votes === undefined) return;
    button.setAttribute("aria-pressed", "true");
    button.textContent = likeText(state, true, votes);
  });
  return button;
}

function reportButton(state: ListState, build: CommunityBuild, card: HTMLElement): HTMLButtonElement {
  const { labels } = state.payload;
  const reported = hasMark(build.id, "report");
  const button = make("button", "community-report", reported ? labels.reported : labels.report);
  button.type = "button";
  button.dataset.report = "";
  button.disabled = reported;
  // Two clicks: the first asks, the second sends; no browser dialog.
  button.addEventListener("click", async () => {
    if (button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      button.textContent = labels.reportAsk;
      return;
    }
    const votes = await act(state, build, "report", button);
    if (votes === undefined) return;
    button.textContent = labels.reported;
    button.disabled = true;
    card.dataset.reported = "true";
  });
  return button;
}

function card(state: ListState, build: CommunityBuild): HTMLLIElement {
  const { payload } = state;
  const item = make("li", "community-card");
  item.dataset.build = build.id;
  item.append(make("h2", "community-title", build.title), itemStrip(build.code, payload.items));
  const date = new Intl.DateTimeFormat(payload.locale, { dateStyle: "medium" }).format(new Date(build.createdAt * 1000));
  const version = build.gameVersion ? payload.labels.version.replace("{version}", () => build.gameVersion) : "";
  item.append(make("p", "community-meta", [version, date].filter(Boolean).join(" · ")));
  const actions = make("div", "community-actions");
  const open = make("a", "community-open", payload.labels.open);
  open.href = `${payload.buildHref}?${build.code}`;
  actions.append(open, likeButton(state, build), reportButton(state, build, item));
  item.append(actions);
  return item;
}

async function load(state: ListState, append: boolean): Promise<void> {
  const { payload, parts } = state;
  const request = ++state.request;
  parts.more.disabled = true;
  const result = await listBuilds(payload.api, state.sort, state.page);
  if (request !== state.request) return;
  parts.more.disabled = false;
  if (!result.ok) {
    parts.status.textContent = payload.labels.loadFailed;
    parts.more.hidden = true;
    return;
  }
  const cards = result.value.builds.map((build) => card(state, build));
  if (append) parts.list.append(...cards);
  else parts.list.replaceChildren(...cards);
  parts.status.textContent = parts.list.childElementCount === 0 ? payload.labels.empty : "";
  parts.more.hidden = !result.value.more;
}

function setSort(state: ListState, sort: Sort): void {
  state.sort = sort;
  state.page = 0;
  for (const button of state.parts.sorts) button.setAttribute("aria-pressed", String(button.dataset.sort === sort));
  void load(state, false);
}

/** Wires up the list; false when the payload or markup is not what the page rendered. */
export function mountCommunityList(root: HTMLElement): boolean {
  const payload = readPayload(root);
  const list = root.querySelector<HTMLElement>("[data-list]");
  const status = root.querySelector<HTMLElement>("[data-status]");
  const more = root.querySelector<HTMLButtonElement>("[data-more]");
  const turnstile = root.querySelector<HTMLElement>("[data-turnstile]");
  const sorts = [...root.querySelectorAll<HTMLButtonElement>("[data-sort]")];
  if (!payload || !list || !status || !more || !turnstile || sorts.length !== 2) return false;
  const state: ListState = { payload, parts: { list, status, more, turnstile, sorts }, sort: "top", page: 0, request: 0 };
  for (const button of sorts) button.addEventListener("click", () => setSort(state, button.dataset.sort === "new" ? "new" : "top"));
  more.addEventListener("click", () => {
    state.page += 1;
    void load(state, true);
  });
  root.hidden = false;
  setSort(state, "top");
  return true;
}
