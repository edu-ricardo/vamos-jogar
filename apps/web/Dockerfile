# Contexto de build: raiz do monorepo (docker build -f apps/web/Dockerfile .)
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
RUN npm ci --workspace=web --include-workspace-root=false

# Configuração pública do Firebase Web (vai no JavaScript do navegador de qualquer forma)
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
# Vazio: o app chama /api no mesmo endereço e o nginx repassa para a API
ENV VITE_API_URL=""

COPY apps/web apps/web
RUN npm run build --workspace=web

FROM nginx:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
