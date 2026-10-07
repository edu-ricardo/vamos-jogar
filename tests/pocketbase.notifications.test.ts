import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PocketBase from 'pocketbase';
import { createPrefsService } from '../apps/api/src/services/notificationPrefs';
import { createEventNotificationService } from '../apps/api/src/services/eventNotificationService';
import { createAttendanceService } from '../apps/api/src/services/attendanceService';
import { resetAppData } from '../apps/api/scripts/migrate/importBackup';

// Avisos de evento, preferências e confirmação de presença no PocketBase real, com o push
// simulado. Cenário: grupo "Sexta" com admin "ana" e membros "bia" e "caio" (nessa ordem);
// "duda" não participa. O evento é criado por "bia".
// Rodado por "npm run test:pocketbase".
const url = process.env.PB_TEST_URL;
const PASSWORD = 'senha-de-teste-123';
type Person = 'ana' | 'bia' | 'caio' | 'duda';
const describeIfPocketBase = url ? describe : describe.skip;

describeIfPocketBase('Notificações de evento e presença', () => {
  const admin = new PocketBase(url);
  admin.autoCancellation(false);
  const getAdmin = async () => admin;
  const ids = {} as Record<Person, string>;
  let groupId: string;

  // Push simulado: cada chamada guarda (tipo do aviso, quem recebeu, mensagem)
  const sent: { kind: string; userIds: string[]; message: { title: string; body: string } }[] = [];
  const prefs = createPrefsService(getAdmin);
  let failNext = false;
  const notifyFor = (kind: string) => async (userIds: string[], message: unknown) => {
    const allowed = await prefs.filterRecipients(userIds, kind as never);
    if (failNext) {
      failNext = false;
      throw new Error('push fora do ar');
    }
    sent.push({ kind, userIds: allowed, message: message as never });
    return allowed.length;
  };
  const notifications = createEventNotificationService(
    getAdmin,
    notifyFor as never,
    () => 'America/Sao_Paulo',
  );
  const attendance = createAttendanceService(getAdmin);

  const pause = () => new Promise((r) => setTimeout(r, 5));
  const sorted = (list: string[]) => [...list].sort();

  const createEvent = (extra: Record<string, unknown> = {}) =>
    admin.collection('events').create({
      group: groupId,
      creator: ids.bia,
      title: 'Jogatina',
      status: 'VOTING_DATE',
      dateOptions: [{ id: 'd1', date: '2026-10-11', startTime: '14:00' }],
      locationOptions: [{ id: 'l1', name: 'Casa do Edu', address: 'Rua das Flores, 100' }],
      ...extra,
    });
  const createDefinedEvent = (extra: Record<string, unknown> = {}) =>
    createEvent({ status: 'VOTING_GAMES', finalDateId: 'd1', finalLocationId: 'l1', ...extra });

  beforeAll(async () => {
    await admin
      .collection('_superusers')
      .authWithPassword(process.env.PB_TEST_ADMIN_EMAIL!, process.env.PB_TEST_ADMIN_PASSWORD!);
  });

  beforeEach(async () => {
    sent.length = 0;
    failNext = false;
    await resetAppData(admin);
    for (const person of ['ana', 'bia', 'caio', 'duda'] as const) {
      ids[person] = (
        await admin.collection('users').create({
          email: `${person}@vamosjogar.test`,
          password: PASSWORD,
          passwordConfirm: PASSWORD,
          name: person.toUpperCase(),
        })
      ).id;
      await pause();
    }
    groupId = (
      await admin.collection('groups').create({ name: 'Sexta', admin: ids.ana, inviteToken: 't1' })
    ).id;
    for (const person of ['ana', 'bia', 'caio'] as const) {
      await admin.collection('memberships').create({ group: groupId, user: ids[person] });
      await pause();
    }
  });

  describe('avisos depois de uma ação do organizador', () => {
    it('evento novo: avisa os outros membros e só uma vez', async () => {
      const event = await createEvent();

      const result = await notifications.announce(event.id, 'created', ids.bia);

      expect(result).toEqual({ ok: true, recipients: 2, notified: 2 });
      expect(sent).toHaveLength(1);
      expect(sent[0].kind).toBe('created');
      expect(sorted(sent[0].userIds)).toEqual(sorted([ids.ana, ids.caio]));
      expect(sent[0].message).toMatchObject({
        title: 'Evento novo: Jogatina',
        url: `/event/${groupId}/${event.id}`,
      });
      expect((await admin.collection('events').getOne(event.id)).announced).toEqual(['created']);

      expect(await notifications.announce(event.id, 'created', ids.bia)).toEqual({
        ok: false,
        reason: 'ALREADY_SENT',
      });
      expect(sent).toHaveLength(1);
    });

    it('data definida e confirmada trazem data, hora e local; cada etapa avisa uma vez', async () => {
      const event = await createDefinedEvent();
      await notifications.announce(event.id, 'date_set', ids.bia);
      await admin.collection('events').update(event.id, { status: 'CONFIRMED' });
      await notifications.announce(event.id, 'confirmed', ids.bia);

      expect(sent.map((s) => [s.kind, s.message.body])).toEqual([
        ['date_set', '11/10 às 14:00 · Casa do Edu. Confirme se você vai e vote nos jogos.'],
        ['confirmed', '11/10 às 14:00 · Casa do Edu. Os jogos da mesa já estão definidos.'],
      ]);
      expect((await admin.collection('events').getOne(event.id)).announced).toEqual([
        'date_set',
        'confirmed',
      ]);
    });

    it('só o criador ou o admin do grupo avisam; outras pessoas e outras etapas são recusadas', async () => {
      const event = await createEvent();

      expect(await notifications.announce(event.id, 'created', ids.caio)).toEqual({
        ok: false,
        reason: 'FORBIDDEN',
      });
      expect(await notifications.announce(event.id, 'created', ids.duda)).toEqual({
        ok: false,
        reason: 'FORBIDDEN',
      });
      expect(await notifications.announce(event.id, 'confirmed', ids.bia)).toEqual({
        ok: false,
        reason: 'WRONG_STATE',
      });
      expect(await notifications.announce('naoexiste12345', 'created', ids.bia)).toEqual({
        ok: false,
        reason: 'EVENT_NOT_FOUND',
      });
      expect(sent).toEqual([]);

      // O admin do grupo pode, mesmo sem ter criado o evento
      expect((await notifications.announce(event.id, 'created', ids.ana)).ok).toBe(true);
      expect(sorted(sent[0].userIds)).toEqual(sorted([ids.bia, ids.caio]));
    });

    it('quem desligou aquele tipo de aviso não recebe', async () => {
      const event = await createEvent();
      await prefs.set(ids.caio, { created: false });

      const result = await notifications.announce(event.id, 'created', ids.bia);

      expect(result).toEqual({ ok: true, recipients: 2, notified: 1 });
      expect(sent[0].userIds).toEqual([ids.ana]);
    });

    it('se o envio falhar, a marca é desfeita e dá para tentar de novo', async () => {
      const event = await createEvent();
      failNext = true;

      await expect(notifications.announce(event.id, 'created', ids.bia)).rejects.toThrow(
        'push fora do ar',
      );
      expect((await admin.collection('events').getOne(event.id)).announced).toEqual([]);

      expect((await notifications.announce(event.id, 'created', ids.bia)).ok).toBe(true);
    });

    it('pelas regras, o organizador não consegue apagar o registro de avisos', async () => {
      const event = await createEvent();
      await notifications.announce(event.id, 'created', ids.bia);
      const bia = new PocketBase(url);
      await bia.collection('users').authWithPassword('bia@vamosjogar.test', PASSWORD);

      // O PocketBase responde 404 quando a regra de atualização barra a mudança
      await expect(
        bia.collection('events').update(event.id, { announced: [] }),
      ).rejects.toMatchObject({ status: 404 });
      // Mas continua podendo editar o próprio evento
      await bia.collection('events').update(event.id, { title: 'Novo título' });
      expect((await admin.collection('events').getOne(event.id)).announced).toEqual(['created']);
    });
  });

  describe('lembrete da véspera', () => {
    // 11/10 às 14:00 em Brasília = 11/10 17:00 UTC
    const evening = new Date('2026-10-10T18:00:00Z'); // 15:00 do dia 10 em Brasília: faltam 23h

    it('avisa os membros, só uma vez, com o endereço', async () => {
      const event = await createDefinedEvent({ status: 'CONFIRMED' });

      expect(await notifications.processEveReminders(evening)).toBe(3);
      expect(sent[0].kind).toBe('eve');
      expect(sorted(sent[0].userIds)).toEqual(sorted([ids.ana, ids.bia, ids.caio]));
      expect(sent[0].message).toMatchObject({
        title: 'Amanhã tem jogatina: Jogatina',
        body: '14:00 · Casa do Edu (Rua das Flores, 100)',
      });
      expect((await admin.collection('events').getOne(event.id)).announced).toEqual(['eve']);

      expect(await notifications.processEveReminders(evening)).toBe(0);
    });

    it('não avisa antes das 24 horas nem depois de a jogatina começar', async () => {
      await createDefinedEvent({ status: 'CONFIRMED' });

      expect(await notifications.processEveReminders(new Date('2026-10-10T16:00:00Z'))).toBe(0);
      expect(await notifications.processEveReminders(new Date('2026-10-11T18:00:00Z'))).toBe(0);
      expect(sent).toEqual([]);
    });

    it('no próprio dia diz "Hoje"', async () => {
      await createDefinedEvent({ status: 'CONFIRMED' });

      await notifications.processEveReminders(new Date('2026-10-11T12:00:00Z'));

      expect(sent[0].message.title).toBe('Hoje tem jogatina: Jogatina');
    });

    it('quem respondeu "não vou" ou desligou o aviso não recebe', async () => {
      const event = await createDefinedEvent({ status: 'CONFIRMED' });
      await attendance.set(event.id, ids.caio, 'no');
      await prefs.set(ids.ana, { eve: false });

      expect(await notifications.processEveReminders(evening)).toBe(1);
      expect(sent[0].userIds).toEqual([ids.bia]);
    });

    it('só considera eventos com data definida', async () => {
      await createEvent();

      expect(await notifications.processEveReminders(evening)).toBe(0);
    });
  });

  describe('confirmação de presença', () => {
    it('grava e atualiza a resposta de cada pessoa e lista todos os membros na ordem de entrada', async () => {
      const event = await createDefinedEvent();

      expect(await attendance.set(event.id, ids.bia, 'maybe')).toEqual({ ok: true });
      expect(await attendance.set(event.id, ids.bia, 'yes')).toEqual({ ok: true });
      await attendance.set(event.id, ids.caio, 'no');

      expect(await admin.collection('attendances').getFullList()).toHaveLength(2);
      expect(await attendance.list(event.id, ids.ana)).toEqual({
        ok: true,
        answers: [
          { userId: ids.ana, name: 'ANA', status: null },
          { userId: ids.bia, name: 'BIA', status: 'yes' },
          { userId: ids.caio, name: 'CAIO', status: 'no' },
        ],
      });
    });

    it('só membros respondem e veem; só depois de a data ser definida', async () => {
      const open = await createEvent();
      const defined = await createDefinedEvent();

      expect(await attendance.set(open.id, ids.bia, 'yes')).toEqual({
        ok: false,
        reason: 'NOT_OPEN',
      });
      expect(await attendance.set(defined.id, ids.duda, 'yes')).toEqual({
        ok: false,
        reason: 'NOT_MEMBER',
      });
      expect(await attendance.list(defined.id, ids.duda)).toEqual({
        ok: false,
        reason: 'NOT_MEMBER',
      });
      expect(await attendance.set('naoexiste12345', ids.bia, 'yes')).toEqual({
        ok: false,
        reason: 'EVENT_NOT_FOUND',
      });
    });

    it('as respostas somem junto com o evento', async () => {
      const event = await createDefinedEvent();
      await attendance.set(event.id, ids.bia, 'yes');

      await admin.collection('events').delete(event.id);

      expect(await admin.collection('attendances').getFullList()).toEqual([]);
    });

    it('pelas regras, ninguém lê nem grava presenças direto no PocketBase', async () => {
      const event = await createDefinedEvent();
      await attendance.set(event.id, ids.bia, 'yes');
      const bia = new PocketBase(url);
      await bia.collection('users').authWithPassword('bia@vamosjogar.test', PASSWORD);

      await expect(bia.collection('attendances').getFullList()).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        bia.collection('attendances').create({ event: event.id, user: ids.bia, status: 'yes' }),
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('preferências de notificação', () => {
    it('começam com tudo ligado, guardam só o que mudou e valem por pessoa', async () => {
      expect(await prefs.get(ids.bia)).toEqual({
        created: true,
        date_set: true,
        confirmed: true,
        eve: true,
        reminder: true,
      });

      expect(await prefs.set(ids.bia, { eve: false })).toMatchObject({ eve: false, created: true });
      expect(await prefs.set(ids.bia, { reminder: false })).toMatchObject({
        eve: false,
        reminder: false,
      });

      expect((await prefs.get(ids.bia)).eve).toBe(false);
      expect((await prefs.get(ids.caio)).eve).toBe(true);
    });

    it('filterRecipients tira só quem desligou aquele tipo', async () => {
      await prefs.set(ids.bia, { eve: false });

      expect(sorted(await prefs.filterRecipients([ids.ana, ids.bia, ids.caio], 'eve'))).toEqual(
        sorted([ids.ana, ids.caio]),
      );
      expect(sorted(await prefs.filterRecipients([ids.ana, ids.bia], 'created'))).toEqual(
        sorted([ids.ana, ids.bia]),
      );
      expect(await prefs.filterRecipients([], 'eve')).toEqual([]);
    });
  });
});
