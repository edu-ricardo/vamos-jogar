/// <reference path="../pb_data/types.d.ts" />

// Esquema inicial do Vamos Jogar no PocketBase, equivalente ao Firestore + firestore.rules.
// Diferenças de modelo: membros, votos e sugestões de jogos viram coleções próprias, para que
// as regras de acesso consigam garantir "cada um altera só o que é seu".
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id;

    // Usuários: campo para ligar ao uid do Firebase durante a migração
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new TextField({ name: 'legacyUid', max: 128 }));
    app.save(users);

    const created = () => ({ name: 'created', type: 'autodate', onCreate: true, onUpdate: false });
    const updated = () => ({ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true });
    const relation = (name, collectionId, extra = {}) => ({
      name,
      type: 'relation',
      collectionId,
      maxSelect: 1,
      required: true,
      cascadeDelete: true,
      ...extra,
    });

    // Grupos (regras definidas depois que memberships existir)
    const groups = new Collection({
      type: 'base',
      name: 'groups',
      fields: [
        { name: 'name', type: 'text', required: true, max: 120 },
        relation('admin', usersId, { cascadeDelete: false }),
        { name: 'inviteToken', type: 'text', required: true, max: 64 },
        { name: 'legacyId', type: 'text', max: 64 },
        created(),
        updated(),
      ],
      indexes: ['CREATE UNIQUE INDEX idx_groups_invite ON groups (inviteToken)'],
    });
    app.save(groups);

    // Quem participa de cada grupo e o apelido usado nele
    const memberships = new Collection({
      type: 'base',
      name: 'memberships',
      listRule: 'group.memberships_via_group.user ?= @request.auth.id',
      viewRule: 'group.memberships_via_group.user ?= @request.auth.id',
      // Só o admin se inclui ao criar o grupo; os demais entram por convite, pela API
      createRule: '@request.body.user = @request.auth.id && group.admin = @request.auth.id',
      updateRule:
        'user = @request.auth.id && @request.body.user:changed = false && @request.body.group:changed = false',
      deleteRule: 'group.admin = @request.auth.id',
      fields: [
        relation('group', groups.id),
        relation('user', usersId),
        { name: 'nickname', type: 'text', max: 80 },
        created(),
      ],
      indexes: ['CREATE UNIQUE INDEX idx_memberships_group_user ON memberships (`group`, user)'],
    });
    app.save(memberships);

    groups.listRule = 'memberships_via_group.user ?= @request.auth.id || admin = @request.auth.id';
    groups.viewRule = 'memberships_via_group.user ?= @request.auth.id || admin = @request.auth.id';
    groups.createRule = '@request.auth.id != "" && @request.body.admin = @request.auth.id';
    groups.updateRule = 'admin = @request.auth.id';
    groups.deleteRule = 'admin = @request.auth.id';
    app.save(groups);

    const memberOfEventGroup = 'event.group.memberships_via_group.user ?= @request.auth.id';
    const memberOfGroup = 'group.memberships_via_group.user ?= @request.auth.id';
    const managesEvent = '(creator = @request.auth.id || group.admin = @request.auth.id)';

    const events = new Collection({
      type: 'base',
      name: 'events',
      listRule: memberOfGroup,
      viewRule: memberOfGroup,
      createRule: `${memberOfGroup} && @request.body.creator = @request.auth.id && @request.body.status = 'VOTING_DATE'`,
      // Criador ou admin editam e avançam etapas; o controle de lembretes é só da API
      updateRule:
        `${memberOfGroup} && ${managesEvent}` +
        ' && @request.body.group:changed = false && @request.body.creator:changed = false' +
        ' && @request.body.lastReminderSentAt:isset = false',
      deleteRule: `${memberOfGroup} && ${managesEvent}`,
      fields: [
        relation('group', groups.id),
        relation('creator', usersId, { cascadeDelete: false }),
        { name: 'title', type: 'text', required: true, max: 200 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['VOTING_DATE', 'VOTING_GAMES', 'CONFIRMED'],
        },
        { name: 'dateOptions', type: 'json', maxSize: 200000 },
        { name: 'locationOptions', type: 'json', maxSize: 200000 },
        { name: 'finalDateId', type: 'text', max: 64 },
        { name: 'finalLocationId', type: 'text', max: 64 },
        { name: 'finalGameIds', type: 'json', maxSize: 200000 },
        { name: 'lastReminderSentAt', type: 'date' },
        { name: 'legacyId', type: 'text', max: 64 },
        created(),
        updated(),
      ],
      indexes: ['CREATE INDEX idx_events_group ON events (`group`)'],
    });
    app.save(events);

    // Jogos sugeridos para um evento; o índice único mantém só a primeira sugestão de cada jogo
    const eventGames = new Collection({
      type: 'base',
      name: 'event_games',
      listRule: memberOfEventGroup,
      viewRule: memberOfEventGroup,
      createRule: `${memberOfEventGroup} && @request.body.suggester = @request.auth.id && event.status = 'VOTING_GAMES'`,
      updateRule: null,
      deleteRule: null,
      fields: [
        relation('event', events.id),
        { name: 'gameId', type: 'text', required: true, max: 64 },
        { name: 'name', type: 'text', required: true, max: 300 },
        { name: 'thumb', type: 'text', max: 2000 },
        relation('suggester', usersId),
        { name: 'suggesterName', type: 'text', max: 120 },
        created(),
      ],
      indexes: ['CREATE UNIQUE INDEX idx_event_games_event_game ON event_games (event, gameId)'],
    });
    app.save(eventGames);

    // Um voto por pessoa e evento: data, local e jogos escolhidos
    const votes = new Collection({
      type: 'base',
      name: 'votes',
      listRule: memberOfEventGroup,
      viewRule: memberOfEventGroup,
      createRule: `${memberOfEventGroup} && @request.body.user = @request.auth.id && event.status != 'CONFIRMED'`,
      updateRule:
        "user = @request.auth.id && event.status != 'CONFIRMED'" +
        ' && @request.body.user:changed = false && @request.body.event:changed = false',
      deleteRule: null,
      fields: [
        relation('event', events.id),
        relation('user', usersId),
        { name: 'dateOptionId', type: 'text', max: 64 },
        { name: 'locationOptionId', type: 'text', max: 64 },
        { name: 'gameIds', type: 'json', maxSize: 200000 },
        created(),
        updated(),
      ],
      indexes: ['CREATE UNIQUE INDEX idx_votes_event_user ON votes (event, user)'],
    });
    app.save(votes);

    // Ludoteca: qualquer usuário logado vê, só o dono altera
    const games = new Collection({
      type: 'base',
      name: 'games',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.body.owner = @request.auth.id',
      updateRule: 'owner = @request.auth.id && @request.body.owner:changed = false',
      deleteRule: 'owner = @request.auth.id',
      fields: [
        relation('owner', usersId),
        { name: 'gameId', type: 'text', required: true, max: 64 },
        { name: 'sourceId', type: 'text', max: 64 },
        { name: 'name', type: 'text', required: true, max: 300 },
        { name: 'image', type: 'text', max: 2000 },
        { name: 'description', type: 'text', max: 100000 },
        { name: 'playtime', type: 'text', max: 32 },
        { name: 'minPlayers', type: 'number', onlyInt: true },
        { name: 'maxPlayers', type: 'number', onlyInt: true },
        { name: 'observation', type: 'text', max: 1000 },
        { name: 'expansions', type: 'json', maxSize: 2000000 },
        created(),
        updated(),
      ],
      indexes: ['CREATE UNIQUE INDEX idx_games_owner_game ON games (owner, gameId)'],
    });
    app.save(games);

    // Endereços são pessoais: só o dono acessa
    const ownerOnly = 'owner = @request.auth.id';
    const favoriteLocations = new Collection({
      type: 'base',
      name: 'favorite_locations',
      listRule: ownerOnly,
      viewRule: ownerOnly,
      createRule: '@request.body.owner = @request.auth.id',
      updateRule: `${ownerOnly} && @request.body.owner:changed = false`,
      deleteRule: ownerOnly,
      fields: [
        relation('owner', usersId),
        { name: 'name', type: 'text', required: true, max: 120 },
        { name: 'address', type: 'text', required: true, max: 500 },
        created(),
      ],
    });
    app.save(favoriteLocations);
  },
  (app) => {
    for (const name of [
      'favorite_locations',
      'games',
      'votes',
      'event_games',
      'events',
      'memberships',
      'groups',
    ]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('legacyUid');
    app.save(users);
  },
);
