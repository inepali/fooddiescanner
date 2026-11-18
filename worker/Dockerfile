# Render worker image. Build from the repo root:
#   gcloud run deploy fooddie-render --source . --dockerfile worker/Dockerfile ...  (see worker/README.md)
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

# Runtime packages only (Supabase, R2 client, ffmpeg-static, which downloads its ffmpeg binary here).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm install --no-save --no-audit --no-fund esbuild@0.24

# Only what the render needs: the shared render code, the worker and the caption font.
COPY src/lib ./src/lib
COPY worker ./worker
COPY assets ./assets
RUN npx esbuild worker/server.ts --bundle --platform=node --format=esm --target=node22 \
      --packages=external --outfile=dist/server.mjs

USER node
EXPOSE 8080
CMD ["node", "dist/server.mjs"]
