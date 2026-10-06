import { timingSafeEqual } from "node:crypto";

import { Schema } from "effect";

const COOKIE = "narration_session";
const ClaimsSchema = Schema.Struct({
  expires: Schema.Number,
  scope: Schema.Literal("session"),
});
type Claims = typeof ClaimsSchema.Type;
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
const decode = (text: string) =>
  Uint8Array.from(
    atob(text.replaceAll("-", "+").replaceAll("_", "/")),
    (character) => character.codePointAt(0) ?? 0
  );
const key = (secret: string) =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"]
  );

export const configuredSecret = (
  secret: string | undefined
): secret is string => typeof secret === "string" && secret.length >= 32;

export const matchesSecret = async (input: string, secret: string) => {
  const [actual, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(input)),
    crypto.subtle.digest("SHA-256", encoder.encode(secret)),
  ]);
  return timingSafeEqual(new Uint8Array(actual), new Uint8Array(expected));
};

export const signCapability = async (secret: string, claims: Claims) => {
  const body = encode(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    encoder.encode(body)
  );
  return `${body}.${encode(new Uint8Array(signature))}`;
};

export const verifyCapability = async (
  token: string,
  secret: string,
  scope: Claims["scope"]
) => {
  if (token.length > 2048) {
    return false;
  }
  try {
    const [body, signature, extra] = token.split(".");
    if (!body || !signature || extra !== undefined) {
      return false;
    }
    const valid = await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      decode(signature),
      encoder.encode(body)
    );
    if (!valid) {
      return false;
    }
    const claims = Schema.decodeUnknownSync(ClaimsSchema)(
      JSON.parse(new TextDecoder().decode(decode(body)))
    );
    return (
      claims.scope === scope &&
      Number.isFinite(claims.expires) &&
      claims.expires > Date.now()
    );
  } catch {
    return false;
  }
};

export const authenticated = (request: Request, secret: string) => {
  const token =
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1) ?? "";
  return verifyCapability(token, secret, "session");
};

export const sessionCookie = (
  request: Request,
  token: string,
  seconds: number
) =>
  `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/pipeline; Max-Age=${seconds}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;

export const sameOrigin = (request: Request) =>
  request.headers.get("Origin") === new URL(request.url).origin;
