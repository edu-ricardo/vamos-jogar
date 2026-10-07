/// <reference path="../pb_data/types.d.ts" />

// Votação de data com várias datas por pessoa ("posso dia 10 ou 11"): votes.dateOptionIds guarda
// a lista. O campo antigo dateOptionId continua existindo (a primeira data escolhida), assim a
// versão anterior do app ainda lê os votos se for preciso voltar atrás.
migrate(
  (app) => {
    const votes = app.findCollectionByNameOrId('votes');
    votes.fields.add(new JSONField({ name: 'dateOptionIds', maxSize: 20000 }));
    app.save(votes);

    // Votos que já existem: a data única vira uma lista de uma data
    for (const vote of app.findAllRecords('votes')) {
      const dateOptionId = vote.getString('dateOptionId');
      if (!dateOptionId) continue;
      vote.set('dateOptionIds', [dateOptionId]);
      app.saveNoValidate(vote);
    }
  },
  (app) => {
    const votes = app.findCollectionByNameOrId('votes');
    votes.fields.removeByName('dateOptionIds');
    app.save(votes);
  },
);
