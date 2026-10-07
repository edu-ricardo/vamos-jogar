# Backup do Vamos Jogar: como conferir e como restaurar

Tudo que o app guarda (usuários, grupos, eventos, votos, ludotecas, inscrições de notificação) fica
**num único banco do PocketBase**, na pasta `pb_data` do servidor. O backup é uma cópia compactada
dessa pasta.

## O que existe hoje

| Item              | Valor                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| Quando roda       | Todo dia às 4h no relógio do container (provavelmente UTC, ou seja ~1h em Brasília) |
| Quantos guarda    | Os 7 mais recentes (os mais antigos são apagados sozinhos)                          |
| Onde fica         | `~/umbrel/app-data/florencio-store-vamos-jogar/data/pb_data/backups/` no Umbrel     |
| Nome dos arquivos | Começam com `@auto_` e terminam em `.zip`                                           |
| Configurado em    | `apps/pocketbase/pb_hooks/backups.pb.js`                                            |

> **Ponto de atenção:** esses backups ficam **no mesmo disco** do banco. Protegem contra erro de
> software, atualização que deu errado ou dado apagado por engano, mas **não** contra defeito ou
> perda do disco/servidor. Por isso o passo 4 (cópia fora do servidor) é o mais importante.

Os backups contêm e-mails e senhas (criptografadas) das pessoas. Guarde sempre fora do Git, por
exemplo em `C:\Users\admin\segredos\backups-pocketbase\`.

---

## Passo 1: os backups existem e são recentes (30 segundos, toda semana)

No computador, conecte ao Umbrel:

```bash
ssh umbrel@umbrel.local
ls -lh ~/umbrel/app-data/florencio-store-vamos-jogar/data/pb_data/backups/
```

Confira:

- Há arquivos `@auto_...zip` e o mais novo tem **menos de 24 horas**.
- Os tamanhos não são zero e são parecidos entre si (o banco cresce devagar). Um arquivo muito
  menor que os outros é sinal de problema.
- Há até 7 arquivos (se houver só 1 ou 2 depois de uma semana, o agendamento não está rodando).

Se não houver backup recente, veja os logs do PocketBase no Umbrel (app Vamos Jogar → logs) e
procure a linha `Backup automático diário configurado`.

## Passo 2: o arquivo não está corrompido (1 minuto)

```bash
cd ~/umbrel/app-data/florencio-store-vamos-jogar/data/pb_data/backups/
python3 -m zipfile -t NOME-DO-ARQUIVO.zip
python3 -m zipfile -l NOME-DO-ARQUIVO.zip
```

O primeiro comando deve terminar com `Done testing`. O segundo deve listar pelo menos `data.db` e
`auxiliary.db`. Se o `data.db` for pequeno demais (poucos KB), o banco estava vazio.

## Passo 3: o backup realmente restaura (5 minutos, uma vez por mês)

Só abrir o zip não prova nada; a prova é subir o banco a partir dele e conferir os números. Faça no
seu computador (Windows, com o Docker Desktop em modo Linux), **sem tocar na produção**.

1. Traga um backup para o PC (veja o passo 4) e abra o PowerShell na pasta dele.
2. Extraia numa pasta de teste:

   ```powershell
   mkdir C:\temp\pbteste\pb_data
   Expand-Archive -Path .\NOME-DO-ARQUIVO.zip -DestinationPath C:\temp\pbteste\pb_data
   ```

3. Suba um PocketBase de teste com essa pasta (use a **mesma versão** que roda na produção, a que
   está no `docker-compose.yml` da loja):

   ```powershell
   docker run -d --name pbteste -p 8099:8090 -v C:\temp\pbteste\pb_data:/pb_data ghcr.io/edu-ricardo/vamos-jogar-pocketbase:2.3.0
   ```

4. Abra <http://localhost:8099/_/> e entre com o e-mail e a senha do superusuário
   (`data/pocketbase.env`; o login vem junto com o banco).
5. Em **Collections**, confira se `users`, `groups`, `events`, `games` etc. têm quantidades
   parecidas com as do app em produção (o painel de Admin do app mostra os usuários; Grupos mostra
   os grupos).
6. Limpe o teste:

   ```powershell
   docker rm -f pbteste
   Remove-Item -Recurse -Force C:\temp\pbteste
   ```

Este procedimento foi executado em 07/10/2026 com um banco de teste: o banco restaurado do zip
tinha exatamente os mesmos números do original (usuários, grupos, participações, eventos, jogos e
votos).

## Passo 4: uma cópia fora do servidor (o mais importante)

Traga os backups para o PC (o comando abaixo roda no PowerShell do seu computador):

```powershell
scp "umbrel@umbrel.local:~/umbrel/app-data/florencio-store-vamos-jogar/data/pb_data/backups/*.zip" "C:\Users\admin\segredos\backups-pocketbase\"
```

Como o servidor guarda só 7 dias, rode isso **pelo menos uma vez por semana**. Dá para agendar no
Agendador de Tarefas do Windows (ação "Iniciar um programa": `powershell`, argumentos
`-Command "scp ..."`). Mesmo sem agendar, quem confere o passo 1 já aproveita para copiar.

Quando tiver muitos arquivos, apague à mão os mais antigos que o último mês.

---

## Como restaurar na produção (só em emergência)

Isto **substitui o banco inteiro**: tudo que foi feito depois do backup (votos, eventos novos) se
perde. Antes, tente corrigir de outro jeito (por exemplo, pelo painel de Admin).

1. Escolha o backup mais recente que ainda está bom e **teste-o** como no passo 3.
2. Pare o app Vamos Jogar pela interface do Umbrel.
3. No Umbrel, guarde o banco atual (não apague):

   ```bash
   cd ~/umbrel/app-data/florencio-store-vamos-jogar/data
   sudo mv pb_data pb_data.antes-da-restauracao
   sudo mkdir pb_data
   sudo python3 -m zipfile -e /caminho/do/backup.zip pb_data
   ```

4. Inicie o app. Entre, confira os dados e, quando tudo estiver certo, apague
   `pb_data.antes-da-restauracao`.
5. Se o app não subir, pare de novo, apague `pb_data`, devolva a pasta guardada
   (`sudo mv pb_data.antes-da-restauracao pb_data`) e inicie.

> Dica: se for restaurar um backup feito por outra versão do app, suba primeiro a mesma versão em
> que o backup foi feito (as versões ficam no `docker-compose.yml` da loja, no histórico do Git).

## Resumo da rotina

| Quando                   | O que fazer                                                           | Tempo  |
| ------------------------ | --------------------------------------------------------------------- | ------ |
| Toda semana              | Passo 1 e copiar os backups para o PC (passo 4)                       | 2 min  |
| Todo mês                 | Passo 2 e passo 3 (restaurar de verdade num container de teste)       | 10 min |
| Antes de atualizar o app | Conferir o passo 1 e copiar o backup mais recente para o PC (passo 4) | 1 min  |
