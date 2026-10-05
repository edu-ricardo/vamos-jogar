/// <reference path="../pb_data/types.d.ts" />

// Painel de administração do app. Só a API (superusuário) lê e grava aqui: as regras ficam
// fechadas para que ninguém se promova a admin nem apague o registro de ações.
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id;

    // Quem recebeu acesso de admin pelo painel (os de APP_ADMIN_EMAILS não precisam estar aqui)
    const admins = new Collection({
      type: 'base',
      name: 'app_admins',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_app_admins_user ON app_admins (user)'],
    });
    app.save(admins);

    // Registro das ações feitas pelo painel; guarda texto para sobreviver à exclusão de contas
    const logs = new Collection({
      type: 'base',
      name: 'admin_logs',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'actorId', type: 'text', max: 32 },
        { name: 'actorEmail', type: 'text', max: 255 },
        { name: 'action', type: 'text', required: true, max: 64 },
        { name: 'details', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
    });
    app.save(logs);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('admin_logs'));
    app.delete(app.findCollectionByNameOrId('app_admins'));
  },
);
