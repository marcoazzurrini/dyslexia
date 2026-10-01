declare module "cloudflare:workers" {
  import type { R2Bucket } from "@cloudflare/workers-types";

  const env: {
    AUDIO: R2Bucket;
  };
  export { env };
}
