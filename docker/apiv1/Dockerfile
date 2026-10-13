# syntax=docker/dockerfile:1
FROM node:24.11.1-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:24.11.1-bookworm-slim AS runtime-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24.11.1-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3005
WORKDIR /app
COPY --from=runtime-dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY --from=build /app/.local/dist ./.local/dist
COPY src/server ./src/server
COPY src/data ./src/data
COPY src/types ./src/types
USER node
EXPOSE 3005
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server/server.ts", "--production"]
