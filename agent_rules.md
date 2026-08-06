# Regras de Desenvolvimento (Para Agentes e Subagentes)

Este documento contém as diretrizes rígidas de arquitetura e boas práticas que DEVERÃO ser seguidas por qualquer desenvolvedor ou agente de Inteligência Artificial que contribua para o projeto **Vamos Jogar**.

## 1. Separação de Conceitos (Separation of Concerns - SoC)

O princípio mais importante. As responsabilidades devem estar estritamente separadas:

- **Frontend (apps/web):**
  - **Componentes React/Páginas (`src/components`, `src/pages`):** Responsáveis APENAS por gerenciar estado local, tratar eventos da UI e renderizar os dados. É estritamente **PROIBIDO** injetar chamadas diretas ao banco de dados (Firebase Firestore/Realtime) ou `fetch`/`axios` dentro dos componentes de tela.
  - **Serviços (`src/services`):** Toda a lógica de acesso a dados (APIs externas, Backend, Firestore) deve ser isolada em funções/classes de serviço exportáveis. O componente React deve apenas chamar essas funções.
  - **Contextos (`src/context`):** Apenas para gerenciamento de estado global não persistente ou encapsulamento de bibliotecas de autenticação.

- **Backend (apps/api):**
  - **Rotas (`src/routes`):** Definem os endpoints (`/api/...`) e os middlewares de proteção/validação. Não devem conter regras de negócio, apenas delegam para o Controller adequado.
  - **Controladores (`src/controllers`):** Recebem as requisições (`req`, `res`), extraem os parâmetros/body, chamam os Serviços, e devolvem a resposta HTTP formatada ao usuário.
  - **Serviços (`src/services`):** Arquivos que detêm toda a regra de negócio e chamadas diretas a banco, bibliotecas ou APIs externas.

## 2. Design de UI e UX

- Sempre priorizar visual Responsivo, _Mobile-First_.
- Suporte constante a Tema Claro / Escuro (Glassmorphism e esquemas de cores pré-estabelecidos).
- Não utilizar _inline styles_ nos componentes React. O projeto conta com SCSS (`.scss`). Use variáveis globais e as classes semânticas (`.btn-primary`, `.btn-danger`, etc) mantendo a aparência padronizada.

## 3. Qualidade de Código e Testes

- Adotar as melhores práticas recomendadas de **Clean Code**.
- As funções devem ser descritivas, puras sempre que possível e fortemente tipadas com `TypeScript`.
- (Futuro) Commits devem passar por verificações de CI (Linting, formatação) e testes automatizados.

## 4. Estrutura Monorepo

- Trabalhamos com **Turborepo** dividindo em:
  - `apps/web`: Frontend React/Vite.
  - `apps/api`: Servidor Express Node.js.
  - `packages/ui`: Componentes compartilhados.
- Scripts de execução devem estar declarados nos seus repectivos `package.json` para que o Turborepo central (raiz) consiga orquestrá-los (ex: `npm run dev`).

Qualquer alteração ou nova Feature adicionada deverá respeitar a estrutura de pastas e responsabilidades descritas acima!

## 5. Padrões de UI e Notificações

- É estritamente proibido o uso de janelas nativas do navegador (\lert\, \prompt\, \confirm\).
- Para mensagens informativas, de erro ou sucesso, utilize a biblioteca \
  eact-hot-toast\ (já instalada no projeto).
- Para entradas e confirmações, desenhe componentes ou \Modals\ (Dialogs) com o mesmo visual Dark/Light adotado no sistema.
