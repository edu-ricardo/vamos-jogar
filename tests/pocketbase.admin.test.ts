import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PocketBase from 'pocketbase';
import { AdminActionError, createAdminService } from '../apps/api/src/services/adminService';
import { createAccountService } from '../apps/api/src/services/accountService';
import { createReminderService } from '../apps/api/src/services/reminderService';
import { resetAppData } from '../apps/api/scripts/migrate/importBackup';

// Painel de admin contra o PocketBase real. Cenário: "edu" é admin fixo (APP_ADMIN_EMAILS);
// grupo "Sexta" com admin "ana" e membros "bia" e "caio".
// Rodado por "npm run test:pocketbase".
const url = process.env.PB_TEST_URL;
const PASSWORD = 'senha-de-teste-123';
type Person = 'edu' | 'ana' | 'bia' | 'caio';
const describeIfPocketBase = url ? describe : describe.skip;

describeIfPocketBase('Painel de admin', () => {
  const admin = new PocketBase(url);
  admin.autoCancellation(false);
  const getAdmin = async () => admin;
  // Push simulado: devolve 1 pessoa avisada, como se só uma tivesse aparelho inscrito
  const notify = vi.fn(async (_userIds: string[], _message: unknown) => 1);
  const service = createAdminService(
    getAdmin,
    createAccountService(getAdmin).deleteAccount,
    () => ['edu@vamosjogar.test'],
    createReminderService(getAdmin, notify).remindEventAsAppAdmin,
  );
  const ids = {} as Record<Person, string>;
  const actor = (person: Person) => ({
    uid: ids[person],
    name: person,
    email: `${person}@vamosjogar.test`,
  });
  let groupId: string;
  // Registros criados no mesmo milissegundo empatam no "created", que decide a ordem
  const pause = () => new Promise((r) => setTimeout(r, 5));

  beforeAll(async () => {
    await admin
      .collection('_superusers')
      .authWithPassword(process.env.PB_TEST_ADMIN_EMAIL!, process.env.PB_TEST_ADMIN_PASSWORD!);
  });

  beforeEach(async () => {
    notify.mockClear();
    await resetAppData(admin);
    for (const name of ['app_admins', 'admin_logs']) {
      for (const r of await admin.collection(name).getFullList({ fields: 'id' })) {
        await admin.collection(name).delete(r.id);
      }
    }
    for (const person of ['edu', 'ana', 'bia', 'caio'] as const) {
      const email = `${person}@vamosjogar.test`;
      ids[person] = (
        await admin.collection('users').create({
          email,
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
    await admin.collection('games').create({ owner: ids.bia, gameId: 'ludo-1', name: 'Catan' });
  });

  const logActions = async () =>
    (await service.listLogs()).map((l) => [l.actorEmail, l.action, l.details]).reverse();

  it('admin fixo pelo e-mail; os demais só depois de receber o acesso', async () => {
    expect(await service.isAppAdmin(actor('edu'))).toBe(true);
    expect(await service.isAppAdmin({ ...actor('edu'), email: 'EDU@vamosjogar.test' })).toBe(true);
    expect(await service.isAppAdmin(actor('bia'))).toBe(false);

    await service.setAdmin(actor('edu'), ids.bia, true);
    await pause();
    await service.setAdmin(actor('edu'), ids.bia, true);
    await pause();
    expect(await service.isAppAdmin(actor('bia'))).toBe(true);
    expect(await admin.collection('app_admins').getFullList()).toHaveLength(1);

    await service.setAdmin(actor('edu'), ids.bia, false);
    expect(await service.isAppAdmin(actor('bia'))).toBe(false);
    expect(await logActions()).toEqual([
      ['edu@vamosjogar.test', 'admin_concedido', 'BIA <bia@vamosjogar.test>'],
      ['edu@vamosjogar.test', 'admin_concedido', 'BIA <bia@vamosjogar.test>'],
      ['edu@vamosjogar.test', 'admin_removido', 'BIA <bia@vamosjogar.test>'],
    ]);
  });

  it('não remove o próprio acesso nem um admin fixo', async () => {
    await service.setAdmin(actor('edu'), ids.bia, true);
    await expect(service.setAdmin(actor('bia'), ids.bia, false)).rejects.toThrow(AdminActionError);
    await expect(service.setAdmin(actor('bia'), ids.edu, false)).rejects.toThrow(/fixo/);
  });

  it('lista usuários com grupos, jogos e quem é admin', async () => {
    await service.setAdmin(actor('edu'), ids.caio, true);
    const users = await service.listUsers();
    expect(
      users.map((u) => [u.email.split('@')[0], u.groups, u.games, u.admin, u.providers]),
    ).toEqual([
      ['edu', 0, 0, 'fixed', []],
      ['ana', 1, 0, null, []],
      ['bia', 1, 1, null, []],
      ['caio', 1, 0, 'panel', []],
    ]);
  });

  it('senha temporária: vale para entrar, derruba a sessão antiga e fica registrada', async () => {
    const session = new PocketBase(url);
    await session.collection('users').authWithPassword('bia@vamosjogar.test', PASSWORD);

    const password = await service.setTemporaryPassword(actor('edu'), ids.bia);

    await expect(session.collection('users').authRefresh()).rejects.toBeTruthy();
    const fresh = new PocketBase(url);
    await fresh.collection('users').authWithPassword('bia@vamosjogar.test', password);
    expect(fresh.authStore.record?.id).toBe(ids.bia);
    expect(JSON.stringify(await service.listLogs())).not.toContain(password);
  });

  it('exclui conta de outra pessoa com as regras de sempre, mas não a própria', async () => {
    await service.deleteUser(actor('edu'), ids.ana);
    expect((await admin.collection('groups').getOne(groupId)).admin).toBe(ids.bia);
    await expect(service.deleteUser(actor('edu'), ids.edu)).rejects.toThrow(/Conta/);
    await expect(service.deleteUser(actor('edu'), 'naoexiste12345')).rejects.toMatchObject({
      status: 404,
    });
    expect(await logActions()).toEqual([
      ['edu@vamosjogar.test', 'conta_excluida', 'ANA <ana@vamosjogar.test>'],
    ]);
  });

  it('grupos: lista membros, transfere admin e remove membro (nunca o admin)', async () => {
    const [group] = await service.listGroups();
    expect(group).toMatchObject({ name: 'Sexta', adminId: ids.ana, events: 0 });
    expect(group.members.map((m) => m.name)).toEqual(['ANA', 'BIA', 'CAIO']);

    await expect(service.transferGroupAdmin(actor('edu'), groupId, ids.edu)).rejects.toThrow(
      /membro/,
    );
    await service.transferGroupAdmin(actor('edu'), groupId, ids.bia);
    await pause();
    expect((await admin.collection('groups').getOne(groupId)).admin).toBe(ids.bia);

    await expect(service.removeMember(actor('edu'), groupId, ids.bia)).rejects.toThrow(/Transfira/);
    await service.removeMember(actor('edu'), groupId, ids.caio);
    expect((await service.listGroups())[0].members.map((m) => m.id)).toEqual([ids.ana, ids.bia]);
    expect((await logActions()).map(([, action, details]) => [action, details])).toEqual([
      ['grupo_novo_admin', 'Sexta: BIA <bia@vamosjogar.test>'],
      ['membro_removido', 'Sexta: CAIO <caio@vamosjogar.test>'],
    ]);
  });

  it('lista só eventos em votação, com quem falta votar na etapa atual', async () => {
    const dates = await admin
      .collection('events')
      .create({ group: groupId, creator: ids.bia, title: 'Data aberta', status: 'VOTING_DATE' });
    await admin
      .collection('events')
      .create({ group: groupId, creator: ids.bia, title: 'Fechado', status: 'CONFIRMED' });
    await admin.collection('votes').create({ event: dates.id, user: ids.bia, dateOptionId: 'd1' });

    expect(await service.listOpenEvents()).toEqual([
      {
        id: dates.id,
        title: 'Data aberta',
        status: 'VOTING_DATE',
        groupId,
        groupName: 'Sexta',
        pendingNames: ['ANA', 'CAIO'],
        lastReminderSentAt: '',
      },
    ]);
  });

  it('cobra os pendentes de qualquer evento sem ser criador nem admin do grupo, e registra', async () => {
    const event = await admin
      .collection('events')
      .create({ group: groupId, creator: ids.bia, title: 'Jogatina', status: 'VOTING_DATE' });
    await admin.collection('votes').create({ event: event.id, user: ids.bia, dateOptionId: 'd1' });

    const message = await service.remindEvent(actor('edu'), event.id);

    expect(message).toBe(
      'Notificação enviada para 1 de 2 pessoa(s) que ainda não votaram. Quem não ativou as notificações não recebe.',
    );
    const [userIds, pushed] = notify.mock.calls[0];
    expect([...userIds].sort()).toEqual([ids.ana, ids.caio].sort());
    expect(pushed).toMatchObject({ url: `/event/${groupId}/${event.id}` });
    expect((await admin.collection('events').getOne(event.id)).lastReminderSentAt).not.toBe('');
    expect((await service.listOpenEvents())[0].lastReminderSentAt).not.toBe('');
    expect(await logActions()).toEqual([
      ['edu@vamosjogar.test', 'cobranca_enviada', 'Sexta: Jogatina (1 de 2)'],
    ]);
  });

  it('não cobra evento confirmado nem inexistente', async () => {
    const closed = await admin
      .collection('events')
      .create({ group: groupId, creator: ids.bia, title: 'Fechado', status: 'CONFIRMED' });

    await expect(service.remindEvent(actor('edu'), closed.id)).rejects.toThrow(/confirmado/);
    await expect(service.remindEvent(actor('edu'), 'naoexiste12345')).rejects.toMatchObject({
      status: 404,
    });
    expect(notify).not.toHaveBeenCalled();
    expect(await logActions()).toEqual([]);
  });

  it('pelas regras, ninguém lê nem grava admins e registro direto no PocketBase', async () => {
    const bia = new PocketBase(url);
    await bia.collection('users').authWithPassword('bia@vamosjogar.test', PASSWORD);
    await expect(bia.collection('app_admins').create({ user: ids.bia })).rejects.toMatchObject({
      status: 403,
    });
    await expect(bia.collection('admin_logs').getFullList()).rejects.toMatchObject({
      status: 403,
    });
  });
});
