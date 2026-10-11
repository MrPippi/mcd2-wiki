import type { Page } from "@playwright/test";

/** How far the page is wider than the window; 0 when nothing scrolls sideways. */
export const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
