# Node / VPS / Fly.io image — serves API + static SPA
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Do not bake library tokens into public images
ENV VITE_MUSIC_ACCESS_TOKEN=
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV MUSIC_DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN mkdir -p /data
EXPOSE 8787
VOLUME ["/data"]
CMD ["node", "dist/server/node.js"]
