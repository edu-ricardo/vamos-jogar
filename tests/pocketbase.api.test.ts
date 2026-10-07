import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PocketBase from 'pocketbase';
import { verifyUserToken } from '../apps/api/src/services/userTokenService';
import { joinGroupByInvite } from '../apps/api/src/services/groupInviteService';
import { createReminderService } from '../apps/api/src/services/reminderService';
import { createAccountService } from '../apps/api/src/services/accountService';

// Serviços da API (que usam o superusuário) contra o PocketBase real.
// Cenário: grupo com admin "ana", membros "bia" e "caio" (nessa ordem de entrada).
// Rodado por "npm run test:pocketbase".
const url = process.env.PB_TEST_URL;
const PASSWORD = 'senha-de-teste-123';
type Person = 'ana' | 'bia' | 'caio' | 'duda';

const client = () => {
  const pb = new PocketBase(url);
  pb.autoCancellation(false);
  return pb;
};

const describeIfPocketBase = url ? describe : describe.skip;

describeIfPocketBase('Serviços da API no PocketBase', () => {
  const admin = client();
  const getAdmin = async () => admin;
  const ids = {} as Record<Person, string>;
  const tokens = {} as Record<Person, string>;
  let groupId: string;

  const membersOf = async (gid: string) =>
    (
      await admin
        .collection('memberships')
        .getFullList({ filter: `group = "${gid}"`, sort: 'created' })
    ).map((m) => m.user);

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
        await admin.collection('users').create({
          email,
          password: PASSWORD,
          passwordConfirm: PASSWORD,
          name: person.toUpperCase(),
        })
      ).id;
      const pb = client();
      await pb.collection('users').authWithPassword(email, PASSWORD);
      tokens[person] = pb.authStore.token;
    }
    groupId = (
      await admin
        .collection('groups')
        .create({ name: 'Sexta', admin: ids.ana, inviteToken: 'convite-1' })
    ).id;
    for (const person of ['ana', 'bia', 'caio'] as const) {
      await admin
        .collection('memberships')
        .create({ group: groupId, user: ids[person], nickname: person });
    }
  });

  describe('token do usuário', () => {
    it('valida o token e devolve quem é', async () => {
      const pb = client();
      pb.authStore.save(tokens.bia);
      expect(await verifyUserToken(pb)).toEqual({
        uid: ids.bia,
        name: 'BIA',
        email: 'bia@vamosjogar.test',
      });
    });

    it('recusa token inválido', async () => {
      const pb = client();
      pb.authStore.save('token-invalido');
      await expect(verifyUserToken(pb)).rejects.toThrow();
    });
  });

  describe('convite', () => {
    const duda = () => ({ uid: ids.duda, name: 'Duda', email: 'duda@vamosjogar.test' });

    it('entra no grupo com o apelido do perfil', async () => {
      expect(await joinGroupByInvite(admin, 'convite-1', duda())).toEqual({
        ok: true,
        groupId,
        groupName: 'Sexta',
      });
      const membership = await admin
        .collection('memberships')
        .getFirstListItem(`group = "${groupId}" && user = "${ids.duda}"`);
      expect(membership.nickname).toBe('Duda');
    });

    it('recusa convite inválido e quem já é membro', async () => {
      expect(await joinGroupByInvite(admin, 'nao-existe', duda())).toEqual({
        ok: false,
        reason: 'INVALID_INVITE',
      });
      await joinGroupByInvite(admin, 'convite-1', duda());
      expect(await joinGroupByInvite(admin, 'convite-1', duda())).toEqual({
        ok: false,
        reason: 'ALREADY_MEMBER',
      });
    });
  });

  describe('lembretes', () => {
    // Simula o push: todo mundo que recebe a notificação tem ao menos um aparelho inscrito
    const notifyAll = () => vi.fn(async (userIds: string[]) => userIds.length);

    it('avisa só quem não votou, com link para o evento, e respeita o intervalo de 3 dias', async () => {
      const event = await admin
        .collection('events')
        .create({ group: groupId, creator: ids.bia, title: 'Jogatina', status: 'VOTING_DATE' });
      await admin
        .collection('votes')
        .create({ event: event.id, user: ids.ana, dateOptionId: 'd1' });
      const notify = notifyAll();
      const reminders = createReminderService(getAdmin, notify);

      expect(await reminders.processScheduledReminders()).toBe(2);
      const [userIds, message] = notify.mock.calls[0];
      expect([...userIds].sort()).toEqual([ids.bia, ids.caio].sort());
      expect(message).toEqual({
        title: 'Falta o seu voto: Jogatina',
        body: 'A galera do Sexta está esperando você votar na data e no local.',
        url: `/event/${groupId}/${event.id}`,
        tag: `lembrete-${event.id}`,
      });
      expect((await admin.collection('events').getOne(event.id)).lastReminderSentAt).not.toBe('');

      expect(await reminders.processScheduledReminders()).toBe(0);
      const fourDaysLater = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
      expect(await reminders.processScheduledReminders(fourDaysLater)).toBe(2);
    });

    it('cobrança manual: criador ou admin; informa pendentes e avisados; confirmado não cobra', async () => {
      const event = await admin
        .collection('events')
        .create({ group: groupId, creator: ids.bia, title: 'Jogatina', status: 'VOTING_GAMES' });
      // Só uma das três pessoas pendentes tem aparelho inscrito
      const reminders = createReminderService(getAdmin, vi.fn().mockResolvedValue(1));

      expect(await reminders.sendRemindersForEvent(groupId, event.id, ids.caio)).toEqual({
        ok: false,
        reason: 'FORBIDDEN',
      });
      expect(await reminders.sendRemindersForEvent(groupId, event.id, ids.ana)).toEqual({
        ok: true,
        pending: 3,
        notified: 1,
      });
      expect(await reminders.sendRemindersForEvent('outro', event.id, ids.ana)).toEqual({
        ok: false,
        reason: 'EVENT_NOT_FOUND',
      });
      await admin.collection('events').update(event.id, { status: 'CONFIRMED' });
      expect(await reminders.sendRemindersForEvent(groupId, event.id, ids.bia)).toEqual({
        ok: false,
        reason: 'EVENT_CONFIRMED',
      });
    });
  });

  describe('exclusão de conta', () => {
    it('admin sai: mais antigo herda; abertos perdem voto e sugestão; encerrados mantêm histórico', async () => {
      const open = await admin
        .collection('events')
        .create({ group: groupId, creator: ids.ana, title: 'Aberto', status: 'VOTING_GAMES' });
      const closed = await admin
        .collection('events')
        .create({ group: groupId, creator: ids.ana, title: 'Encerrado', status: 'CONFIRMED' });
      for (const event of [open, closed]) {
        await admin
          .collection('votes')
          .create({ event: event.id, user: ids.ana, gameIds: ['ludo-1'] });
        await admin.collection('event_games').create({
          event: event.id,
          gameId: 'ludo-1',
          name: 'Catan',
          suggester: ids.ana,
          suggesterName: 'Ana',
        });
      }
      await admin.collection('games').create({ owner: ids.ana, gameId: 'ludo-1', name: 'Catan' });
      await admin
        .collection('favorite_locations')
        .create({ owner: ids.ana, name: 'Casa', address: 'Rua A' });
      const soloGroup = await admin
        .collection('groups')
        .create({ name: 'Só eu', admin: ids.ana, inviteToken: 'convite-2' });
      await admin.collection('memberships').create({ group: soloGroup.id, user: ids.ana });
      await admin
        .collection('events')
        .create({ group: soloGroup.id, creator: ids.ana, title: 'Solo', status: 'VOTING_DATE' });

      await createAccountService(getAdmin).deleteAccount(ids.ana);

      expect((await admin.collection('groups').getOne(groupId)).admin).toBe(ids.bia);
      expect(await membersOf(groupId)).toEqual([ids.bia, ids.caio]);
      await expect(admin.collection('groups').getOne(soloGroup.id)).rejects.toMatchObject({
        status: 404,
      });
      expect(
        await admin.collection('events').getFullList({ filter: `group = "${soloGroup.id}"` }),
      ).toEqual([]);

      expect(
        await admin.collection('votes').getFullList({ filter: `event = "${open.id}"` }),
      ).toEqual([]);
      expect(
        await admin.collection('event_games').getFullList({ filter: `event = "${open.id}"` }),
      ).toEqual([]);
      const [closedVote] = await admin
        .collection('votes')
        .getFullList({ filter: `event = "${closed.id}"` });
      expect(closedVote).toMatchObject({ user: '', gameIds: ['ludo-1'] });
      const [closedGame] = await admin
        .collection('event_games')
        .getFullList({ filter: `event = "${closed.id}"` });
      expect(closedGame).toMatchObject({ suggester: '', suggesterName: 'Ana' });
      expect((await admin.collection('events').getOne(open.id)).creator).toBe('');

      expect(await admin.collection('games').getFullList()).toEqual([]);
      expect(await admin.collection('favorite_locations').getFullList()).toEqual([]);
      await expect(admin.collection('users').getOne(ids.ana)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('sair do grupo', () => {
    const accounts = () => createAccountService(getAdmin);

    it('membro comum sai: perde só os votos e sugestões dos eventos abertos; o admin continua', async () => {
      const open = await admin
        .collection('events')
        .create({ group: groupId, creator: ids.ana, title: 'Aberto', status: 'VOTING_GAMES' });
      const closed = await admin
        .collection('events')
        .create({ group: groupId, creator: ids.ana, title: 'Fechado', status: 'CONFIRMED' });
      for (const event of [open, closed]) {
        await admin.collection('votes').create({ event: event.id, user: ids.bia, gameIds: ['x'] });
      }

      expect(await accounts().leaveGroup(ids.bia, groupId)).toEqual({
        ok: true,
        groupDeleted: false,
      });

      expect(await membersOf(groupId)).toEqual([ids.ana, ids.caio]);
      expect((await admin.collection('groups').getOne(groupId)).admin).toBe(ids.ana);
      expect(
        await admin.collection('votes').getFullList({ filter: `event = "${open.id}"` }),
      ).toEqual([]);
      expect(
        await admin.collection('votes').getFullList({ filter: `event = "${closed.id}"` }),
      ).toHaveLength(1);
      // A conta continua existindo
      expect((await admin.collection('users').getOne(ids.bia)).id).toBe(ids.bia);
    });

    it('admin sai: o membro mais antigo restante herda o grupo', async () => {
      await accounts().leaveGroup(ids.ana, groupId);

      expect((await admin.collection('groups').getOne(groupId)).admin).toBe(ids.bia);
      expect(await membersOf(groupId)).toEqual([ids.bia, ids.caio]);
    });

    it('o último membro sai: o grupo é apagado com os eventos', async () => {
      const solo = await admin
        .collection('groups')
        .create({ name: 'Só eu', admin: ids.duda, inviteToken: 'convite-solo' });
      await admin.collection('memberships').create({ group: solo.id, user: ids.duda });
      await admin
        .collection('events')
        .create({ group: solo.id, creator: ids.duda, title: 'Solo', status: 'VOTING_DATE' });

      expect(await accounts().leaveGroup(ids.duda, solo.id)).toEqual({
        ok: true,
        groupDeleted: true,
      });

      await expect(admin.collection('groups').getOne(solo.id)).rejects.toMatchObject({
        status: 404,
      });
      expect(
        await admin.collection('events').getFullList({ filter: `group = "${solo.id}"` }),
      ).toEqual([]);
    });

    it('quem não é membro não consegue sair (nem mexer no grupo dos outros)', async () => {
      expect(await accounts().leaveGroup(ids.duda, groupId)).toEqual({
        ok: false,
        reason: 'NOT_MEMBER',
      });
      expect(await membersOf(groupId)).toEqual([ids.ana, ids.bia, ids.caio]);
    });
  });
});
