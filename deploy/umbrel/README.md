# Vamos Jogar no Umbrel

Pacote do app para uma loja comunitária do Umbrel. Nesta fase o app roda no Umbrel mas
ainda usa o Firebase para login e banco de dados.

## 1. Publicar as imagens (uma vez por versão)

1. No GitHub, em _Settings → Secrets and variables → Actions → Variables_, crie as variáveis
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` e `VITE_FIREBASE_APP_ID`
   com os valores de `apps/web/.env`.
2. Crie e envie a tag da versão: `git tag v1.0.0 && git push origin v1.0.0`.
3. O workflow _Imagens Docker_ publica `ghcr.io/edu-ricardo/vamos-jogar-api` e `-web`.
4. Na primeira vez, em _Packages_ no GitHub, deixe os dois pacotes **públicos**
   (o Umbrel baixa as imagens sem login).

## 2. Adicionar à loja

1. Copie a pasta `STORE_ID-vamos-jogar/` para o repositório da sua loja.
2. Troque `STORE_ID` pelo `id` do `umbrel-app-store.yml` no nome da pasta e nos dois arquivos.
3. Confira se a porta `3080` do `umbrel-app.yml` não está em uso por outro app.

## 3. Instalar e configurar no Umbrel

1. Instale o app pela loja.
2. Preencha `~/umbrel/app-data/<id>-vamos-jogar/data/api.env` (via SSH) e reinicie o app.
   Guarde uma cópia desse arquivo fora do Umbrel.
3. No console do Firebase, em _Authentication → Settings → Authorized domains_, adicione o
   endereço pelo qual o app será acessado (ex.: o domínio do Cloudflare Tunnel).

## Atualizar

Crie uma nova tag (`v1.0.1`), troque a versão das imagens no `docker-compose.yml` e o
`version` do `umbrel-app.yml` na loja, e atualize o app pelo Umbrel.

## Testar localmente antes

```bash
docker compose --env-file apps/web/.env up --build
```

O app abre em http://localhost:3080, com a mesma montagem (nginx + API) do Umbrel.
