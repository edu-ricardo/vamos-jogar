# Vamos Jogar no Umbrel

O pacote do app fica na loja comunitária
[florencio-store](https://github.com/edu-ricardo/florencio-store), na pasta
`florencio-store-vamos-jogar/`. Este repositório só gera as imagens Docker.

## 1. Publicar as imagens (uma vez por versão)

1. No GitHub, em _Settings → Secrets and variables → Actions → Variables_, crie as variáveis
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` e `VITE_FIREBASE_APP_ID`
   com os valores de `apps/web/.env`.
2. Crie e envie a tag da versão, por exemplo `v1.0.0` (ou `v1.0.0-homolog` para homologação).
3. O workflow _Imagens Docker_ publica `ghcr.io/edu-ricardo/vamos-jogar-api` e `-web`.
   Tags com sufixo (`-homolog`) não atualizam a imagem `latest`.
4. Na primeira vez, em _Packages_ no GitHub, deixe os dois pacotes **públicos**
   (o Umbrel baixa as imagens sem login).

## 2. Atualizar a loja

No `florencio-store-vamos-jogar/` da loja, troque a versão das imagens no `docker-compose.yml`
e o `version` do `umbrel-app.yml`, faça o commit e atualize o app pelo Umbrel.

## 3. Primeira instalação no Umbrel

1. Instale o app pela loja.
2. Preencha `~/umbrel/app-data/florencio-store-vamos-jogar/data/api.env` (via SSH) e reinicie
   o app. Guarde uma cópia desse arquivo fora do Umbrel.
3. No console do Firebase, em _Authentication → Settings → Authorized domains_, adicione o
   endereço pelo qual o app será acessado (ex.: o domínio do Cloudflare Tunnel).

## Testar localmente antes

```bash
docker compose --env-file apps/web/.env up --build
```

O app abre em http://localhost:3080, com a mesma montagem (nginx + API) do Umbrel.
