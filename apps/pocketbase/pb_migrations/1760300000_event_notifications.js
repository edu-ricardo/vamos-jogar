/// <reference path="../pb_data/types.d.ts" />

// Notificações de evento e confirmação de presença.
// - events.announced: quais avisos já foram enviados (created, date_set, confirmed, eve), para
//   nunca avisar duas vezes; só a API grava.
// - users.notificationPrefs: o que cada pessoa quer receber (padrão: tudo).
// - attendances: "vou / não vou / talvez" por pessoa e evento; só a API lê e grava.
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id;
    const events = app.findCollectionByNameOrId('events');

    events.fields.add(new JSONField({ name: 'announced', maxSize: 2000 }));
    // Organizador edita o evento, mas não pode apagar o registro de avisos já enviados
    events.updateRule += ' && @request.body.announced:isset = false';
    app.save(events);

    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new JSONField({ name: 'notificationPrefs', maxSize: 2000 }));
    app.save(users);

    const attendances = new Collection({
      type: 'base',
      name: 'attendances',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'event',
          type: 'relation',
          collectionId: events.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: 'user',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['yes', 'no', 'maybe'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_attendances_event_user ON attendances (event, user)'],
    });
    app.save(attendances);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('attendances'));

    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('notificationPrefs');
    app.save(users);

    const events = app.findCollectionByNameOrId('events');
    events.fields.removeByName('announced');
    events.updateRule = events.updateRule.replace(' && @request.body.announced:isset = false', '');
    app.save(events);
  },
);
