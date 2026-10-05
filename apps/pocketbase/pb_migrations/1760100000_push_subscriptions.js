/// <reference path="../pb_data/types.d.ts" />

// Aparelhos inscritos para receber notificações (Web Push) de cada pessoa. Um registro por
// aparelho/navegador; a API envia para todos os aparelhos da pessoa e apaga os que expiraram.
// Só a API grava aqui: num aparelho compartilhado, a inscrição passa para quem está logado.
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id;
    const ownerOnly = 'user = @request.auth.id';

    const subscriptions = new Collection({
      type: 'base',
      name: 'push_subscriptions',
      listRule: ownerOnly,
      viewRule: ownerOnly,
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
        { name: 'endpoint', type: 'text', required: true, max: 2000 },
        { name: 'p256dh', type: 'text', required: true, max: 200 },
        { name: 'auth', type: 'text', required: true, max: 100 },
        { name: 'userAgent', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_push_subscriptions_endpoint ON push_subscriptions (endpoint)',
      ],
    });
    app.save(subscriptions);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('push_subscriptions'));
  },
);
