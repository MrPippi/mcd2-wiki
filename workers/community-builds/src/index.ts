/** Cloudflare Worker entry: wires the API to D1, Turnstile and the clock. */
import { handle, type Env } from "./handlers";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 10;

async function verifyTurnstile(secret: string, token: string, ip: string | null): Promise<boolean> {
  if (token.length === 0 || token.length > 2048) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const response = await fetch(VERIFY_URL, { method: "POST", body: form });
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join("");
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env, {
      verifyTurnstile: (token, ip) => verifyTurnstile(env.TURNSTILE_SECRET, token, ip),
      now: () => Math.floor(Date.now() / 1000),
      randomId,
    });
  },
};
