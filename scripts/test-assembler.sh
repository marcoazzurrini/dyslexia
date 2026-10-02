#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Match the architecture used by both local verification and GitHub CI.
# Dependency/image layers are cached; each smoke test gets a fresh container.
image=$(docker build --platform linux/arm64 --quiet containers/assembler)
docker run --rm --platform linux/arm64 --network none "$image" node smoke.mjs
