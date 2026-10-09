import type { Lang } from "./config";

const PLACEHOLDER_LABEL: Readonly<Record<Lang, string>> = { zh: "{數值}", en: "{value}" };
const HEX_COLOR = /^#([0-9A-Fa-f]{6})(?:[0-9A-Fa-f]{2})?$/;
const TOKEN = /<([A-Za-z]+)((?:\s+[A-Za-z]+="[^"]*")*)\s*>|<\/>|\{(\w+)\}|\r?\n/g;
const ATTRIBUTE = /([A-Za-z]+)="([^"]*)"/g;
const ANY_TAG = /<[A-Za-z]+(?:\s+[A-Za-z]+="[^"]*")*\s*>|<\/>/g;

type Frame = "em" | "span" | "none" | "literal";

const CLOSE: Readonly<Record<Frame, string>> = { em: "</em>", span: "</span>", none: "", literal: "&lt;/&gt;" };
const HTML_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

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
    const [token, tagName, rawAttributes, placeholder] = match;
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
    } else if (placeholder !== undefined) {
      html += `<span class="placeholder">${PLACEHOLDER_LABEL[lang]}</span>`;
    } else {
      html += "<br>";
    }
  }
  html += escapeHtml(text.slice(last));
  html += [...stack].reverse().map((frame) => (frame === "literal" ? "" : CLOSE[frame])).join("");
  return { html, warnings };
}

export const stripMarkup = (text: string): string => text.replace(ANY_TAG, "").replace(/\s+/g, " ").trim();
