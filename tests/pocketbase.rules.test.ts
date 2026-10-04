import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import PocketBase from 'pocketbase';

// Regras de acesso do PocketBase: o equivalente ao firestore.rules.test.ts, focado no que deve ser
// bloqueado. Cenário: grupo com admin "ana", membros "bia" e "caio"; "duda" é de fora.
// Rodado por "npm run test:pocketbase".
const url = process.env.PB_TEST_URL;
const PASSWORD = 'senha-de-teste-123';
type Person = 'ana' | 'bia' | 'caio' | 'duda';

const client = () => {
  const pb = new PocketBase(url);
  pb.autoCancellation(false);
  return pb;
};

const denied = async (promise: Promise<unknown>) => {
  const err = await promise.then(
    () => null,
    (e) => e,
  );
  expect(err, 'a operação deveria ter sido bloqueada').not.toBeNull();
  expect([400, 403, 404]).toContain(err.status);
};

const describeIfPocketBase = url ? describe : describe.skip;

describeIfPocketBase('Regras de acesso do PocketBase', () => {
  const admin = client();
  const as = {} as Record<Person, PocketBase>;
  const ids = {} as Record<Person, string>;
  let groupId: string;
  let votingDateEvent: string;
  let votingGamesEvent: string;

  beforeAll(async () => {
    await admin
      .collection('_superusers')
      .authWithPassword(process.env.PB_TEST_ADMIN_EMAIL!, process.env.PB_TEST_ADMIN_PASSWORD!);
  });

  beforeEach(async () => {
    for (const name of [
      'votes',
      'event_games',
      'events',
      'memberships',
      'groups',
      'games',
      'favorite_locations',
      'users',
    ]) {
      for (const r of await admin.collection(name).getFullList({ fields: 'id' })) {
        await admin.collection(name).delete(r.id);
      }
    }
    for (const person of ['ana', 'bia', 'caio', 'duda'] as const) {
      const email = `${person}@vamosjogar.test`;
      ids[person] = (
        await admin
          .collection('users')
          .create({ email, password: PASSWORD, passwordConfirm: PASSWORD })
      ).id;
      as[person] = client();
      await as[person].collection('users').authWithPassword(email, PASSWORD);
    }

    groupId = (
      await admin.collection('groups').create({ name: 'Grupo', admin: ids.ana, inviteToken: 'tok' })
    ).id;
    for (const person of ['ana', 'bia', 'caio'] as const) {
      await admin
        .collection('memberships')
        .create({ group: groupId, user: ids[person], nickname: person });
    }
    votingDateEvent = (
      await admin
        .collection('events')
        .create({ group: groupId, creator: ids.bia, title: 'Datas', status: 'VOTING_DATE' })
    ).id;
    votingGamesEvent = (
      await admin
        .collection('events')
        .create({ group: groupId, creator: ids.bia, title: 'Jogos', status: 'VOTING_GAMES' })
    ).id;
    await admin
      .collection('votes')
      .create({ event: votingDateEvent, user: ids.ana, dateOptionId: 'd1' });
    await admin.collection('games').create({ owner: ids.bia, gameId: 'ludo-1', name: 'Catan' });
    await admin
      .collection('favorite_locations')
      .create({ owner: ids.bia, name: 'Casa', address: 'Rua X' });
  });

  describe('grupos e membros', () => {
    it('quem é de fora não vê o grupo, os membros nem os eventos', async () => {
      await denied(as.duda.collection('groups').getOne(groupId));
      expect(await as.duda.collection('memberships').getFullList()).toEqual([]);
      expect(await as.duda.collection('events').getFullList()).toEqual([]);
      expect(await as.bia.collection('events').getFullList()).toHaveLength(2);
    });

    it('não dá para criar grupo em nome de outra pessoa nem se incluir em grupo alheio', async () => {
      await denied(
        as.duda.collection('groups').create({ name: 'X', admin: ids.ana, inviteToken: 't2' }),
      );
      await denied(as.duda.collection('memberships').create({ group: groupId, user: ids.duda }));
    });

    it('só o admin altera o grupo e remove membros; cada um muda só o próprio apelido', async () => {
      await denied(as.bia.collection('groups').update(groupId, { name: 'Tomado' }));
      const caio = await admin
        .collection('memberships')
        .getFirstListItem(`group = "${groupId}" && user = "${ids.caio}"`);
      await denied(as.bia.collection('memberships').update(caio.id, { nickname: 'X' }));
      await denied(as.bia.collection('memberships').delete(caio.id));
      await as.ana.collection('memberships').delete(caio.id);
    });
  });

  describe('eventos', () => {
    it('membro comum não edita, não avança etapa nem exclui evento de outro', async () => {
      await denied(
        as.caio.collection('events').update(votingDateEvent, { status: 'VOTING_GAMES' }),
      );
      await denied(as.caio.collection('events').delete(votingDateEvent));
      await as.ana.collection('events').update(votingDateEvent, { title: 'Pelo admin' });
    });

    it('ninguém cria evento em nome de outro ou já avançado', async () => {
      await denied(
        as.caio
          .collection('events')
          .create({ group: groupId, creator: ids.bia, title: 'X', status: 'VOTING_DATE' }),
      );
      await denied(
        as.caio
          .collection('events')
          .create({ group: groupId, creator: ids.caio, title: 'X', status: 'CONFIRMED' }),
      );
      await denied(
        as.duda
          .collection('events')
          .create({ group: groupId, creator: ids.duda, title: 'X', status: 'VOTING_DATE' }),
      );
    });

    it('cliente não grava o controle de lembretes nem troca o grupo do evento', async () => {
      await denied(
        as.ana
          .collection('events')
          .update(votingDateEvent, { lastReminderSentAt: new Date().toISOString() }),
      );
      const other = await admin
        .collection('groups')
        .create({ name: 'Outro', admin: ids.ana, inviteToken: 't3' });
      await denied(as.ana.collection('events').update(votingDateEvent, { group: other.id }));
    });
  });

  describe('votos e sugestões', () => {
    it('cada um vota só por si e não mexe no voto dos outros', async () => {
      await as.caio
        .collection('votes')
        .create({ event: votingDateEvent, user: ids.caio, dateOptionId: 'd2' });
      await denied(
        as.caio
          .collection('votes')
          .create({ event: votingDateEvent, user: ids.bia, dateOptionId: 'd2' }),
      );
      const anaVote = await admin.collection('votes').getFirstListItem(`user = "${ids.ana}"`);
      await denied(as.caio.collection('votes').update(anaVote.id, { dateOptionId: 'd2' }));
      await denied(as.caio.collection('votes').delete(anaVote.id));
      await denied(as.duda.collection('votes').create({ event: votingDateEvent, user: ids.duda }));
    });

    it('evento confirmado não aceita mais votos', async () => {
      await admin.collection('events').update(votingDateEvent, { status: 'CONFIRMED' });
      const anaVote = await admin.collection('votes').getFirstListItem(`user = "${ids.ana}"`);
      await denied(as.ana.collection('votes').update(anaVote.id, { dateOptionId: 'd2' }));
      await denied(as.caio.collection('votes').create({ event: votingDateEvent, user: ids.caio }));
    });

    it('sugestões só na fase de jogos, em nome próprio, e ninguém apaga a dos outros', async () => {
      const suggestion = await as.caio
        .collection('event_games')
        .create({ event: votingGamesEvent, gameId: 'ludo-1', name: 'Catan', suggester: ids.caio });
      await denied(
        as.caio
          .collection('event_games')
          .create({ event: votingDateEvent, gameId: 'ludo-2', name: 'X', suggester: ids.caio }),
      );
      await denied(
        as.caio
          .collection('event_games')
          .create({ event: votingGamesEvent, gameId: 'ludo-3', name: 'X', suggester: ids.bia }),
      );
      await denied(as.bia.collection('event_games').delete(suggestion.id));
      await denied(as.caio.collection('event_games').update(suggestion.id, { name: 'Outro' }));
    });
  });

  describe('dados pessoais', () => {
    it('ludoteca: logado vê, só o dono altera', async () => {
      expect(await as.duda.collection('games').getFullList()).toHaveLength(1);
      const game = await admin.collection('games').getFirstListItem('gameId = "ludo-1"');
      await denied(as.ana.collection('games').update(game.id, { name: 'X' }));
      await denied(as.ana.collection('games').delete(game.id));
      await denied(
        as.ana.collection('games').create({ owner: ids.bia, gameId: 'bgg-9', name: 'X' }),
      );
      await denied(as.bia.collection('games').update(game.id, { owner: ids.ana }));
      // Listagem sem permissão não dá erro: a regra filtra e nada é devolvido
      expect(await client().collection('games').getFullList()).toEqual([]);
    });

    it('locais favoritos e dados de usuário: só o dono', async () => {
      expect(await as.ana.collection('favorite_locations').getFullList()).toEqual([]);
      expect(await as.bia.collection('favorite_locations').getFullList()).toHaveLength(1);
      await denied(
        as.ana.collection('favorite_locations').create({ owner: ids.bia, name: 'X', address: 'Y' }),
      );
      await denied(as.ana.collection('users').getOne(ids.bia));
    });
  });
});
