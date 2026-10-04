# Contexto de build: raiz do monorepo (docker build -f apps/pocketbase/Dockerfile .)
FROM alpine:3.22

ARG PB_VERSION=0.40.4
# Checksum oficial de pocketbase_${PB_VERSION}_linux_amd64.zip (checksums.txt da release)
ARG PB_SHA256=9042ec818570e79c3628dadcd0a756c1496d9e1173918ec409d133c02f82e5fa

RUN apk add --no-cache ca-certificates unzip wget \
  && wget -q -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
  && echo "${PB_SHA256}  /tmp/pb.zip" | sha256sum -c - \
  && unzip /tmp/pb.zip pocketbase -d /pb \
  && rm /tmp/pb.zip

# Esquema e regras de acesso versionados; aplicados automaticamente ao iniciar
COPY apps/pocketbase/pb_migrations /pb/pb_migrations

EXPOSE 8090
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data", "--migrationsDir=/pb/pb_migrations", "--automigrate=false"]
