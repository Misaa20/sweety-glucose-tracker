FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
RUN npm ci
COPY client ./client
COPY shared ./shared
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
COPY --from=build --chown=node:node /app/client/dist ./client/dist
USER node
EXPOSE 3001
CMD ["sh", "-c", "node server/scripts/migrate.js && node server/src/index.js"]
