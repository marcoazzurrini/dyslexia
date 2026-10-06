FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS node
FROM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS bun

# Keep the browser version aligned with @playwright/test in apps/web/package.json.
FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -sf bun /usr/local/bin/bunx

ENV CI=true \
    LEFTHOOK=0 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    WRANGLER_SEND_METRICS=false

WORKDIR /app

# Code changes do not invalidate the dependency layer.
COPY package.json bun.lock .node-version ./
COPY apps/web/package.json ./apps/web/
COPY apps/assembler/package.json ./apps/assembler/
RUN test "$(node --version)" = "v$(tr -d '\r\n' < .node-version)" \
    && test "bun@$(bun --version)" = "$(node -p 'require("./package.json").packageManager')" \
    && node -e 'if (require("./apps/web/package.json").devDependencies["@playwright/test"] !== "1.63.0") process.exit(1)'
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

# The allowlisted context excludes credentials, recordings, host dependencies,
# generated files, and local agent data. Builds run on the Linux filesystem.
COPY . .
CMD ["bun", "run", "check"]
