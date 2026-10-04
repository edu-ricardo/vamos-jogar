# Contexto de build: raiz do monorepo (docker build -f apps/api/Dockerfile .)
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
RUN npm ci --workspace=api --include-workspace-root=false
COPY apps/api apps/api
RUN npm run build --workspace=api

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
RUN npm ci --workspace=api --include-workspace-root=false --omit=dev && npm cache clean --force
COPY --from=build /repo/apps/api/dist apps/api/dist
# Importação do backup do Firebase, rodada dentro do servidor (node dist-scripts/migrate/migrate.js)
COPY --from=build /repo/apps/api/dist-scripts apps/api/dist-scripts
WORKDIR /repo/apps/api
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
