import { fileValue, plainText } from "./ui-dicts";
import type { Lang } from "./config";

/** The label shown in place of a value that is filled in later, from the language file (wrapped in braces). */
const placeholderLabel = (lang: Lang): string => plainText(fileValue(lang, "placeholderLabel") ?? "{}");
const HEX_COLOR = /^#([0-9A-Fa-f]{6})(?:[0-9A-Fa-f]{2})?$/;
const TOKEN = /<([A-Za-z]+)((?:\s+[A-Za-z]+="[^"]*")*)\s*>|<\/>|\{(\d+)\}\|plural\(([^)]*)\)|\{(\w+)\}|\r?\n/g;
const ATTRIBUTE = /([A-Za-z]+)="([^"]*)"/g;
const ANY_TAG = /<[A-Za-z]+(?:\s+[A-Za-z]+="[^"]*")*\s*>|<\/>/g;

type Frame = "em" | "span" | "none" | "literal";

const CLOSE: Readonly<Record<Frame, string>> = { em: "</em>", span: "</span>", none: "", literal: "&lt;/&gt;" };
const HTML_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/** Parses the game's `one=a,few=b` plural list into a form -> text map. */
function parsePluralForms(body: string): Record<string, string> {
  return Object.fromEntries(
    body
      .split(",")
      .map((pair) => pair.split("=").map((part) => part.trim()))
      .filter((pair) => pair.length === 2 && pair[0] !== "")
      .map(([form, text]) => [form, text]),
  );
}

export interface RenderResult {
  readonly html: string;
  readonly warnings: string[];
}

function parseAttributes(raw: string): Record<string, string> {
  return Object.fromEntries([...raw.matchAll(ATTRIBUTE)].map(([, key, value]) => [key.toLowerCase(), value]));
}

function openTag(name: string, rawAttributes: string, literal: string): { html: string; frame: Frame; warning?: string } {
  const tag = name.toLowerCase();
  if (tag === "emphasis") return { html: '<em class="emphasis">', frame: "em" };
  if (tag === "swdecorator") {
    const color = parseAttributes(rawAttributes).color ?? "";
    const match = HEX_COLOR.exec(color);
    return match
      ? { html: `<span style="color:#${match[1]}">`, frame: "span" }
      : { html: "", frame: "none", warning: `invalid color "${color}"` };
  }
  return { html: escapeHtml(literal), frame: "literal", warning: `unknown tag <${name}>` };
}

export function renderMarkup(text: string, lang: Lang): RenderResult {
  const stack: Frame[] = [];
  const warnings: string[] = [];
  let html = "";
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [token, tagName, rawAttributes, pluralSlot, pluralBody, placeholder] = match;
    html += escapeHtml(text.slice(last, match.index));
    last = match.index + token.length;
    if (tagName !== undefined) {
      const opened = openTag(tagName, rawAttributes ?? "", token);
      html += opened.html;
      stack.push(opened.frame);
      if (opened.warning) warnings.push(opened.warning);
    } else if (token === "</>") {
      const frame = stack.pop();
      html += frame ? CLOSE[frame] : "&lt;/&gt;";
    } else if (pluralSlot !== undefined) {
      const forms = escapeHtml(JSON.stringify(parsePluralForms(pluralBody ?? "")));
      html += `<span class="plural" data-slot="${pluralSlot}" data-forms="${forms}"></span>`;
    } else if (placeholder !== undefined) {
      html += `<span class="placeholder" data-slot="${placeholder}">${placeholderLabel(lang)}</span>`;
    } else {
      html += "<br>";
    }
  }
  html += escapeHtml(text.slice(last));
  html += [...stack].reverse().map((frame) => (frame === "literal" ? "" : CLOSE[frame])).join("");
  return { html, warnings };
}

export const stripMarkup = (text: string): string => text.replace(ANY_TAG, "").replace(/\s+/g, " ").trim();
