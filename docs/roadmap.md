# Roadmap do Vamos Jogar

Ordem combinada em 07/10/2026: **técnico → funcionalidades → visual**. Cada fase vira uma ou mais
versões, no mesmo fluxo de sempre (branch → testes → merge → tag → imagens → loja, com branch de
volta).

Legenda de esforço: **P** (horas), **M** (um dia), **G** (vários dias). ✅ feito · 🔜 próximo ·
⬜ pendente.

## Já entregue

| Versão | O que                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------- |
| 2.1.0  | Lembretes de voto por notificação (Web Push) com agendador interno                                                  |
| 2.2.0  | Versão desktop: menu lateral, tema claro/escuro, páginas em colunas, filtros da ludoteca, contagem de votos ao vivo |
| 2.3.0  | Painel de administração (usuários, senha temporária, grupos, registro) e troca de senha                             |
| 2.4.0  | Aba Eventos no painel (cobrar votos), testes de tela e guia de backup                                               |
| 2.5.0  | Sair do grupo, filtros na sugestão de jogos e exportar evento para o calendário                                     |

---

## Fase 1 — Técnico (versão 2.4.0)

| #   | Item                                                                                                                                                                                   | Esforço | Estado        | Como saber que ficou bom                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------- | ---------------------------------------------------------------------------------------------- |
| 1.1 | **Testes de tela** (Início, Grupos, Conta, Ludoteca, Evento, Admin, Layout, Modal)                                                                                                     | M       | ✅            | 45 testes novos; quebrar uma regra de propósito (permissão do organizador) faz um teste falhar |
| 1.2 | **Cobrança de votos pelo painel de admin** (aba Eventos: quem falta votar, botão "Cobrar", registrado no log)                                                                          | P       | ✅            | Testado no PocketBase real e no navegador                                                      |
| 1.3 | **Guia de backup** ([backup.md](backup.md)): conferir, restaurar de verdade num container de teste, cópia fora do servidor                                                             | P       | ✅            | Restauração testada: números idênticos ao original                                             |
| 1.4 | **Cópia semanal dos backups para fora do servidor** (hoje ficam no mesmo disco do banco)                                                                                               | P       | 🔜 sua ação   | Pasta `backups-pocketbase` no PC com arquivos da última semana                                 |
| 1.5 | Corrigir avisos do lint (dependências de `useEffect`, erros não usados)                                                                                                                | P       | ⬜            | `npx oxlint` sem avisos                                                                        |
| 1.6 | **Limpeza do Firebase** (fase 5 da migração): remover código e dependências do Firebase, o app de homologação e o backup antigo. **Só depois de ~04/11/2026** (fim da janela de volta) | M       | ⬜            | App menor; `firebase` fora do `package.json`; testes de contrato só do PocketBase              |
| 1.7 | Teste de ponta a ponta do fluxo principal (criar grupo → evento → votar → confirmar) num navegador real, rodando no CI                                                                 | G       | ⬜ (opcional) | Pipeline falha se o fluxo quebrar                                                              |

## Fase 2 — Funcionalidades (versões 2.5.x)

Ordem pensada para entregar valor cedo e deixar o que mexe no banco por último. Decisão: **fora do
escopo** por enquanto — renovar/invalidar link de convite do grupo e comentários no evento.

| #      | Item                                                                                                                    | Esforço | Depende de                      | Notas                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 ✅ | **Sair do grupo** (membro sai sozinho; se for admin, passa ao membro mais antigo; votos abertos saem)                   | P       | —                               | Reaproveita `planGroupDeparture` da exclusão de conta; o último membro apaga o grupo (a tela avisa)                                                                                                                                      |
| 2.2 ✅ | **Sugestão de jogos que cabem na mesa**: filtro por jogadores e duração ao sugerir                                      | P       | —                               | Reaproveita `filterCollection`; mesmo componente de filtros da Ludoteca                                                                                                                                                                  |
| 2.3 ✅ | **Adicionar ao calendário** (arquivo `.ics`) na página do evento, assim que a data é definida                           | P       | —                               | Gerado no navegador, sem servidor. Na tela inicial ficou o link do Google Agenda que já existia                                                                                                                                          |
| 2.4 ✅ | **Mais notificações**: evento novo, data definida, jogatina confirmada e lembrete na véspera, com preferências em Conta | M       | —                               | Evento novo, data definida e confirmado (a API valida e avisa uma vez só), véspera (agendador; quem disse "não vou" fica de fora) e preferências em Conta, valendo em todos os aparelhos. Migração com `announced` e `notificationPrefs` |
| 2.5 ✅ | **Confirmação de presença** ("vou / não vou / talvez") depois que o evento é confirmado                                 | M       | 2.4 (avisar quem não respondeu) | Cartão "Você vai?" no evento com data definida (vou / talvez / não vou) e lista de quem vem e de quem não respondeu. Coleção nova `attendances`, só a API lê e grava                                                                     |
| 2.6    | **Votação mais flexível**: votar em várias datas, acrescentar data depois, destacar a opção líder e o empate            | G       | —                               | Muda o modelo de voto (hoje 1 data e 1 local por pessoa); precisa de migração dos votos existentes                                                                                                                                       |
| 2.7    | **Ludoteca**: ordenação, cadastro manual de jogo (quando a Ludopedia/BGG não achar) e "quem tem o jogo X" no grupo      | M       | —                               | O "quem tem" é uma consulta no grupo                                                                                                                                                                                                     |
| 2.8    | **Histórico do grupo**: eventos passados e jogos que foram para a mesa (mais jogados)                                   | M       | —                               | Só leitura sobre dados que já existem                                                                                                                                                                                                    |
| 2.9    | **Votação por ranking de jogos** (em vez de só marcar)                                                                  | G       | 2.6                             | Mais ambicioso; avaliar depois de usar a 2.6                                                                                                                                                                                             |

## Fase 3 — Visual (versões 2.6.x)

| #   | Item                                                                                                                                 | Esforço | Notas                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------- |
| 3.1 | **Início com "o que precisa de ação"**: próximo evento em destaque (contagem regressiva) e avisos como "falta seu voto em 2 eventos" | M       | Maior efeito percebido; usa dados que já carregam |
| 3.2 | **Estados de carregamento e vazios** com esqueletos e ilustrações simples no lugar de "Carregando..."                                | M       | Componente único reaproveitado nas páginas        |
| 3.3 | **Iniciais/avatares** nos membros, votantes e listas                                                                                 | P       | Cor derivada do nome                              |
| 3.4 | **Capas de jogos sem imagem** (cor + inicial)                                                                                        | P       | Evita quadros vazios                              |
| 3.5 | **Calendário do mês** com os eventos (Início ou Grupos)                                                                              | M       | Depende do 2.3 só para o visual coerente          |
| 3.6 | **Convite para instalar o app** (PWA) no celular                                                                                     | P       | Aviso discreto, uma vez                           |
| 3.7 | **Acessibilidade e polimento**: foco visível no teclado, contraste conferido nos dois temas, animações de entrada nas janelas        | M       | Conferir com os testes de tela já existentes      |

---

## Como cada item entra em produção

1. Branch própria a partir da `main`, com testes novos para o que mudou.
2. `npm test`, `npm run test:pocketbase`, lint e build verdes; conferência no navegador em 1440px
   e 390px (claro e escuro) quando tiver tela.
3. Merge na `main`, tag `vX.Y.Z`, imagens publicadas pela action.
4. Loja (`florencio-store`): nova versão com os digests das imagens e uma branch de volta
   (`vamos-jogar-rollback-X.Y`) com as imagens da versão anterior.
5. Se a versão mexe no banco ou pede variável nova no `data/*.env`, isso vai escrito nas notas da
   versão da loja.
