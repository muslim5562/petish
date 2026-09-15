FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# This non-secret URL is used only for client generation. No database is contacted at build time.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run db:generate
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build BETTER_AUTH_URL=https://build.invalid BETTER_AUTH_SECRET=build-only-placeholder-not-a-runtime-secret PETISH_DEMO=false npm run build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# Keep the CLI dependencies to run checked database migrations during startup.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/src/generated ./src/generated
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/prisma.config.ts /app/next.config.ts ./
COPY --from=build --chown=node:node /app/scripts/hosted-config.mjs /app/scripts/start-hosted.mjs ./scripts/
USER node
EXPOSE 3000
CMD ["node","scripts/start-hosted.mjs"]
