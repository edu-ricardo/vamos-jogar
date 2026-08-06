# Projeto aplicativo Vamos Jogar

## Stack de Tecnologia

- Typescript
- SCSS
- HTML
- Firebase para Autenticação, Banco de Dados e Hospedagem (versões gratuitas)

## Estrutura inicial do projeto

- `apps/web` para frontend
- `apps/api` para rotas de api/servidor
- `packages/ui` para componentes compartilhados

## Descrição do Projeto:

O projeto tem como objetivo servir para mim e para meus amigos como um HUB para marcarmos e organizarmos nossos encontros para jogar jogos de tabuleiros.

## Requisitos:

1. O Aplicativo deve ter um sistema de login usando tanto cadastro com email e senha como com login integrado do google

2. Permitir que a principio editando no banco eu transforme um usuario em "admin" para poder criar um grupo de jogo

3. Permitir que os jogadores cadastrem sua biblioteca de jogos usando os dados da LudoAPI (https://ludopedia.com.br/api/documentacao.html) As principais informações que devemos trazer são as seguintes: Nome do Jogo, Descrição, Tempo da Partida e se tivermos uma imagem para mostrar do jogo. Se o jogo não for encontrado na API permitir o cadastro, podemos usar também a api do BGG (https://boardgamegeek.com/wiki/page/BGG_XML_API2) como fallback principalmente para caso de termos jogos internacionais não lançados no brasil e que possam não estar na outra API.

Meus dados de acesso:

    APP_ID: 65e3d835635c51cb

    APP_KEY: ec06284deb2a4d1bd96130e97c372a0e

    ACESS_TOKEN (Usuário): 732db3ef9bb75aadde381b00333cac46

4. Ter um sistema de marcação de data para a "Jogatina" e votar na data e horario melhor para cada um. Deve permitir tabém escolhermos o lugar onde vamos com uma tela para voluntariar o local.

5. Após marcado ter um sistema de votação para indicarmos qual jogos vamos jogar.

   5.1. Esse sistema deve primeiro permitir que cada jogador indique da sua ludoteca de jogos quais ele pretende levar e que devem entrar na votação, deve também ter uma opção simples de mandar todos os seus jogos para votação.

   5.2. O sistema depois do primeiro jogador confirmar seus jogos mandar para os outros um e-mail a cada 3 dias para relembra-lo de confirmar sua seleção. (essa função trazer na analise se na estrutura informada já é possivel fazer isso)

   5.3. Depois disso enviar para todos o link da pesquisa, na pagina de pesquisa deve informar a data e horarios decididos além de informar os jogos com suas imagens e descrições além do tempo médi ode duração de uma partida.

# Requisitos UI - UX e Técnicos

1. Deve funcionar em navegadores e smartphones com um visual responsivo
2. Deve permitir modo claro e escuro e por padrão trazer o do sistema
3. Usar componentes modernos e já estabelecidos para evitar problemas de compatibilidade
4. Dar preferencia a pacotes com menor overhead para a aplicação abrir leve em todos os dispositivos
5. Sempre implementar funcionalidades com testes automaticos que devem ser rodados sempre ao commitar esse projeto que deverá ser enviado para o seguinte repositorio no github: https://github.com/edu-ricardo/vamos-jogar.git
