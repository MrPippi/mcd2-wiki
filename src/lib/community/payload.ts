/** Server side of the community builds page and the publish form: the item names and icons, and the texts the browser needs. */
import { LANG_META } from "../../../shared/langs";
import { publishedEntries } from "../data";
import { inPool } from "../build/payload";
import { byPool } from "../build/slots";
import { t, type Lang, type UiKey } from "../i18n";
import { assetUrl, href } from "../url";
import type { ErrorLabel, ItemIndex } from "./cards";
import { COMMUNITY_API, TURNSTILE_SITE_KEY } from "./config";

const LABEL_KEYS = {
  sortTop: "communitySortTop",
  sortNew: "communitySortNew",
  open: "communityOpen",
  like: "communityLike",
  liked: "communityLiked",
  report: "communityReport",
  reportAsk: "communityReportAsk",
  reported: "communityReported",
  more: "communityMore",
  empty: "communityEmpty",
  loadFailed: "communityLoadFailed",
  actionFailed: "communityActionFailed",
  version: "communityVersion",
  publishing: "communityPublishing",
  published: "communityPublished",
  view: "communityView",
  errExists: "communityErrExists",
  errTitle: "communityErrTitle",
  errEmpty: "communityErrEmpty",
  errRate: "communityErrRate",
  errHidden: "communityErrHidden",
  errVerify: "communityErrVerify",
} as const satisfies Record<string, UiKey> & Record<ErrorLabel, UiKey>;

export type CommunityLabels = Readonly<Record<keyof typeof LABEL_KEYS, string>>;

export interface CommunityPayload {
  readonly lang: Lang;
  /** BCP 47 tag for dates and the Turnstile widget. */
  readonly locale: string;
  readonly api: string;
  readonly siteKey: string;
  /** The build page, to which a build's query string is appended. */
  readonly buildHref: string;
  /** The community builds page. */
  readonly listHref: string;
  readonly labels: CommunityLabels;
}

export interface CommunityListPayload extends CommunityPayload {
  readonly items: ItemIndex;
}

export const communityLabels = (lang: Lang): CommunityLabels =>
  Object.fromEntries(Object.entries(LABEL_KEYS).map(([name, key]) => [name, t(lang, key)])) as CommunityLabels;

export const communityPayload = (lang: Lang): CommunityPayload => ({
  lang,
  locale: LANG_META[lang].htmlLang,
  api: COMMUNITY_API,
  siteKey: TURNSTILE_SITE_KEY,
  buildHref: href(lang, "build"),
  listHref: href(lang, "builds"),
  labels: communityLabels(lang),
});

/** Every item a build slot can hold, by pool and slug: its name in `lang` and its icon. */
export const itemIndex = (lang: Lang): ItemIndex =>
  byPool((pool) =>
    Object.fromEntries(
      publishedEntries.filter((entry) => inPool(entry, pool)).map((entry) => [entry.slug, [entry.name[lang], entry.icon ? assetUrl(entry.icon) : undefined] as const]),
    ),
  );

export const communityListPayload = (lang: Lang): CommunityListPayload => ({ ...communityPayload(lang), items: itemIndex(lang) });

/** The payload as `<script type="application/json">` content: "<" escaped so the text can never close the tag. */
export const communityJson = (payload: CommunityPayload): string => JSON.stringify(payload).replace(/</g, "\u003c");
