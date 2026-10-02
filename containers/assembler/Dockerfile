FROM node:24.20.0-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 appuser

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY assembly.mjs server.mjs smoke.mjs ./

ENV NODE_ENV=production
ENV ALLOW_LOCAL_ASSEMBLY=false
USER appuser
EXPOSE 8080
CMD ["node", "server.mjs"]
