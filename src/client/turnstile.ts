/** Cloudflare Turnstile on demand: the script loads on the first action that needs a token, never on page load. */
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Long enough to click an interactive challenge, short enough that a stuck one gives the button back. */
const TIMEOUT_MS = 60_000;

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widget: string): void;
  reset(widget: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | undefined;

function loadApi(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile: no API after load")));
    script.onerror = () => {
      loading = undefined;
      reject(new Error("turnstile: script failed to load"));
    };
    document.head.append(script);
  });
  return loading;
}

/**
 * A fresh token for one request. The widget lives in `container` and only shows itself when Cloudflare wants the
 * visitor to click; each call renders it anew so a token is never reused.
 */
export async function turnstileToken(siteKey: string, container: HTMLElement, lang: string): Promise<string> {
  const api = await loadApi();
  container.replaceChildren();
  return new Promise<string>((resolve, reject) => {
    // A challenge nobody answers must not leave the page waiting forever.
    const timer = setTimeout(() => fail("turnstile: no answer"), TIMEOUT_MS);
    const done = (token: string) => {
      clearTimeout(timer);
      resolve(token);
    };
    function fail(message: string) {
      clearTimeout(timer);
      container.replaceChildren();
      reject(new Error(message));
    }
    api.render(container, {
      sitekey: siteKey,
      // Turnstile wants lowercase tags (zh-tw, pt-br).
      language: lang.toLowerCase(),
      appearance: "interaction-only",
      callback: done,
      "error-callback": () => fail("turnstile: challenge failed"),
      "expired-callback": () => fail("turnstile: token expired"),
      "timeout-callback": () => fail("turnstile: challenge timed out"),
      "unsupported-callback": () => fail("turnstile: browser not supported"),
    });
  });
}
