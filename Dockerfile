# Node / VPS / Fly.io image — serves API + static SPA
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_MUSIC_ACCESS_TOKEN=
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV MUSIC_DATA_DIR=/data
# Set LIBRARY_TOKEN at runtime if this port is reachable from the internet.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force \
  && groupadd -r music && useradd -r -g music -d /app music \
  && mkdir -p /data && chown -R music:music /app /data
COPY --from=build --chown=music:music /app/dist ./dist
USER music
EXPOSE 8787
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server/node.js"]
