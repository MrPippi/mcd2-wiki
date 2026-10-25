/** The build page's "publish to community builds" form in the browser. */
import { hasItems } from "../lib/community/cards";
import type { CommunityPayload } from "../lib/community/payload";
import { publishBuild } from "./community-api";
import { turnstileToken } from "./turnstile";

interface PublishParts {
  readonly form: HTMLFormElement;
  readonly title: HTMLInputElement;
  readonly submit: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly link: HTMLAnchorElement;
  readonly turnstile: HTMLElement;
}

function readPayload(root: HTMLElement): CommunityPayload | undefined {
  try {
    const value = JSON.parse(root.querySelector("[data-community-json]")?.textContent ?? "") as CommunityPayload;
    return typeof value.api === "string" && typeof value.siteKey === "string" && typeof value.labels === "object" ? value : undefined;
  } catch {
    return undefined; // not JSON: the caller reports it like any other bad payload
  }
}

function partsOf(root: HTMLElement): PublishParts | undefined {
  const parts = {
    form: root.querySelector<HTMLFormElement>("[data-publish-form]"),
    title: root.querySelector<HTMLInputElement>("[data-publish-title]"),
    submit: root.querySelector<HTMLButtonElement>("[data-publish-submit]"),
    status: root.querySelector<HTMLElement>("[data-publish-status]"),
    link: root.querySelector<HTMLAnchorElement>("[data-publish-link]"),
    turnstile: root.querySelector<HTMLElement>("[data-turnstile]"),
  };
  return Object.values(parts).every(Boolean) ? (parts as PublishParts) : undefined;
}

async function publish(payload: CommunityPayload, parts: PublishParts): Promise<void> {
  const { labels } = payload;
  parts.link.hidden = true;
  if (!hasItems(location.search)) {
    parts.status.textContent = labels.errEmpty;
    return;
  }
  parts.submit.disabled = true;
  parts.status.textContent = labels.publishing;
  try {
    const token = await turnstileToken(payload.siteKey, parts.turnstile, payload.locale);
    const result = await publishBuild(payload.api, { code: location.search, title: parts.title.value, lang: payload.lang, token });
    parts.status.textContent = result.ok ? labels.published : labels[result.label];
    // Published, or already there: either way the list has it.
    if (result.ok || result.label === "errExists") {
      parts.link.hidden = false;
      if (result.ok) parts.title.value = "";
    }
  } catch (error) {
    console.error("community builds:", error);
    parts.status.textContent = labels.errVerify;
  } finally {
    parts.submit.disabled = false;
  }
}

/** Wires up the form; false when the payload or markup is not what the page rendered. */
export function mountCommunityPublish(root: HTMLElement): boolean {
  const payload = readPayload(root);
  const parts = partsOf(root);
  if (!payload || !parts) return false;
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void publish(payload, parts);
  });
  root.hidden = false;
  return true;
}
