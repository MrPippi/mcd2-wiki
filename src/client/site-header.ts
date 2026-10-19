import { withCurrentLocation } from "../lib/lang-switch";

const COMPARE_KEY = "mcd2-compare";
const LANG_KEY = "mcd2-lang";

/** The compare toggle flips between "on" and "off"; anything but "off" counts as on. */
export function nextCompare(current: string | undefined): "on" | "off" {
  return current === "off" ? "on" : "off";
}

export function isComparePressed(current: string | undefined): boolean {
  return current !== "off";
}

/** Whether a click on the narrow-screen search toggle opens it (it is closed unless aria-expanded is "true"). */
export function searchOpensOnClick(expanded: string | null): boolean {
  return expanded !== "true";
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the choice lasts for this page view (or navigation) only.
  }
}

function mountCompare(root: Document): void {
  const html = root.documentElement;
  const button = root.querySelector<HTMLButtonElement>(".compare-toggle");
  const sync = () => button?.setAttribute("aria-pressed", String(isComparePressed(html.dataset.compare)));
  sync();
  button?.addEventListener("click", () => {
    const next = nextCompare(html.dataset.compare);
    html.dataset.compare = next;
    store(COMPARE_KEY, next);
    sync();
  });
}

// Every language link keeps the current page's query and anchor, also when the map page rewrites them.
function mountLangLinks(root: Document): void {
  const langLinks = [...root.querySelectorAll<HTMLAnchorElement>(".lang-picker a")];
  const picker = root.querySelector<HTMLDetailsElement>(".lang-picker");
  const bases = langLinks.map((link) => link.getAttribute("href") ?? "");
  const syncLang = () =>
    langLinks.forEach((link, index) => link.setAttribute("href", withCurrentLocation(bases[index] ?? "", location.search, location.hash)));
  if (picker && picker.dataset.home !== "true") {
    syncLang();
    window.addEventListener("hashchange", syncLang);
    // The map page rewrites its query and hash with history.replaceState, which fires no event of its own.
    window.addEventListener("mcd2:locationchange", syncLang);
  }
  for (const link of langLinks) link.addEventListener("click", () => store(LANG_KEY, link.dataset.lang ?? ""));
}

// The language menu and the site menu: Esc or an outside click closes them, and opening one closes the other.
function mountMenus(root: Document): void {
  const headerMenus = [...root.querySelectorAll<HTMLDetailsElement>(".site-header details.header-menu")];
  for (const menu of headerMenus) {
    menu.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !menu.open) return;
      menu.open = false;
      menu.querySelector("summary")?.focus();
    });
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      for (const other of headerMenus) if (other !== menu) other.open = false;
    });
  }
  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;
    const target = event.target;
    for (const menu of headerMenus) if (menu.open && !menu.contains(target)) menu.open = false;
  });
}

// Narrow screens fold the header search behind a button (see layout.css).
function mountSearchToggle(root: Document): void {
  const searchToggle = root.querySelector<HTMLButtonElement>(".search-toggle");
  const searchForm = root.querySelector<HTMLFormElement>(".header-search");
  const setSearchOpen = (open: boolean) => {
    searchForm?.classList.toggle("is-open", open);
    searchToggle?.setAttribute("aria-expanded", String(open));
  };
  searchToggle?.addEventListener("click", () => {
    const open = searchOpensOnClick(searchToggle.getAttribute("aria-expanded"));
    setSearchOpen(open);
    if (open) searchForm?.querySelector("input")?.focus();
  });
  searchForm?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || searchToggle?.offsetParent === null) return;
    setSearchOpen(false);
    searchToggle?.focus();
  });
}

export function mountSiteHeader(root: Document): void {
  mountCompare(root);
  mountLangLinks(root);
  mountMenus(root);
  mountSearchToggle(root);
}
