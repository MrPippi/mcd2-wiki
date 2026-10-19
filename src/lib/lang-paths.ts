import { LANGS, type Lang } from "../../shared/langs";

/** `getStaticPaths()` for a page that exists once per language; the language is also passed as `Astro.props.lang`. */
export const langPaths = (): { params: { lang: Lang }; props: { lang: Lang } }[] =>
  LANGS.map((lang) => ({ params: { lang }, props: { lang } }));
