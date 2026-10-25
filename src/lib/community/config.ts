/** Where the community builds API lives, and the Turnstile widget it checks. Both are public. Loaded by the browser, so no imports. */
export const COMMUNITY_API = "https://mcd2-wiki-builds.jack3555tw.workers.dev";
/** The Turnstile widget `mcd2-wiki-builds` (domains mrpippi.github.io and localhost). */
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFlOn_tyotwdoz0w";
/** Mirrors the worker's limit (workers/community-builds/src/validate.ts MAX_TITLE_LENGTH). */
export const MAX_TITLE_LENGTH = 40;
