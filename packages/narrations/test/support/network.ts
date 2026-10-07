import { ORIGIN } from "./api.ts";

// Effect reads `fetch` once per process, on first use. Install one fetch
// for every test that relies on it, and route its requests per test.

const unrouted = () => Promise.reject(new Error("No route for this request"));
let route: (request: Request) => Promise<Response> = unrouted;

const original = globalThis.fetch;
globalThis.fetch = Object.assign(
  (input: RequestInfo | URL, init?: RequestInit) =>
    route(new Request(input, init)),
  { preconnect: original.preconnect }
);
Object.assign(globalThis, { location: { origin: ORIGIN } });

/** Sends every `fetch` to `next` until it is routed elsewhere. */
export const routeFetch = (next: typeof route) => {
  route = next;
};
