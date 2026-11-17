FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM base AS builder
WORKDIR /app
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json yarn.lock ./
COPY prisma ./prisma
COPY nest-cli.json tsconfig.json ./
COPY src ./src
RUN yarn prisma:generate && yarn build

FROM base AS migrator
WORKDIR /app
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/prisma ./prisma
ENV NODE_ENV=production
CMD ["yarn", "prisma:deploy"]

FROM base AS production-dependencies
WORKDIR /app
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
COPY package.json yarn.lock ./
COPY prisma ./prisma
RUN yarn install --frozen-lockfile --production=true && yarn prisma:generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=6001
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 6001
CMD ["node", "dist/main.js"]
