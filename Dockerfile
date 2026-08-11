# Plain Node — the whole point of takumi is that there is no browser to bake in.
# Debian (not alpine) because @takumi-rs/core ships glibc prebuilds.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    CACHE_DIR=/data/cache \
    PORT=3300

WORKDIR /app
RUN corepack enable

# pnpm-workspace.yaml carries the minimumReleaseAge exclusions; without it the install
# fails inside the image on packages that pass locally.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY . .

# 28 MiB of Noto, never committed. Baked in at build time so a cold start needs no network.
RUN pnpm fonts

RUN mkdir -p /data/cache && chown -R node:node /data /app
USER node

EXPOSE 3300

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3300)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "start"]
