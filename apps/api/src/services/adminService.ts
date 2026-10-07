import type PocketBase from 'pocketbase/cjs';
import { getAdminClient } from '../lib/pocketbase';
import { accountService } from './accountService';
import { generateTemporaryPassword, parseAdminEmails } from './adminRules';
import { reminderService } from './notifications';
import type { AdminReminderResult } from './reminderService';
import { describeReminderOutcome, getPendingVoterIds } from './reminderRules';
import type { AuthenticatedUser } from './userTokenService';

// Recusa de uma ação do painel, com a mensagem mostrada a quem tentou
export class AdminActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  created: string;
  // Provedores externos (ex.: google); vazio = só e-mail e senha
  providers: string[];
  groups: number;
  games: number;
  pushDevices: number;
  admin: 'fixed' | 'panel' | null;
}

export interface AdminGroup {
  id: string;
  name: string;
  adminId: string;
  members: { id: string; name: string }[];
  events: number;
}

// Evento ainda em votação, com quem falta votar na etapa atual
export interface AdminEvent {
  id: string;
  title: string;
  status: 'VOTING_DATE' | 'VOTING_GAMES';
  groupId: string;
  groupName: string;
  pendingNames: string[];
  // Último lembrete enviado (automático ou manual); vazio se nunca houve
  lastReminderSentAt: string;
}

export interface AdminLog {
  id: string;
  actorEmail: string;
  action: string;
  details: string;
  created: string;
}

const countBy = (records: { [key: string]: unknown }[], field: string) =>
  records.reduce<Record<string, number>>((acc, r) => {
    const key = String(r[field]);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

export const createAdminService = (
  getAdmin: () => Promise<PocketBase>,
  deleteAccount: (uid: string) => Promise<void>,
  fixedAdminEmails: () => string[],
  remindEvent: (eventId: string) => Promise<AdminReminderResult>,
) => {
  const isFixedAdmin = (email: string) => fixedAdminEmails().includes(email.toLowerCase());

  const findPanelAdmin = async (pb: PocketBase, uid: string) =>
    (
      await pb.collection('app_admins').getFullList({ filter: pb.filter('user = {:uid}', { uid }) })
    )[0];

  const getUser = async (pb: PocketBase, uid: string) => {
    try {
      return await pb.collection('users').getOne(uid);
    } catch {
      throw new AdminActionError('Usuário não encontrado.', 404);
    }
  };

  const getGroup = async (pb: PocketBase, groupId: string) => {
    try {
      return await pb.collection('groups').getOne(groupId);
    } catch {
      throw new AdminActionError('Grupo não encontrado.', 404);
    }
  };

  const log = async (actor: AuthenticatedUser, action: string, details: string) => {
    const pb = await getAdmin();
    await pb
      .collection('admin_logs')
      .create({ actorId: actor.uid, actorEmail: actor.email, action, details });
  };

  const describe = (user: Record<string, any>) =>
    user.name ? `${user.name} <${user.email}>` : user.email || '(sem e-mail)';

  return {
    isAppAdmin: async (user: AuthenticatedUser): Promise<boolean> => {
      if (user.email && isFixedAdmin(user.email)) return true;
      return !!(await findPanelAdmin(await getAdmin(), user.uid));
    },

    listUsers: async (): Promise<AdminUser[]> => {
      const pb = await getAdmin();
      const usersCollection = await pb.collections.getOne('users');
      const [users, memberships, games, devices, externalAuths, panelAdmins] = await Promise.all([
        pb.collection('users').getFullList({ sort: 'created' }),
        pb.collection('memberships').getFullList({ fields: 'user' }),
        pb.collection('games').getFullList({ fields: 'owner' }),
        pb.collection('push_subscriptions').getFullList({ fields: 'user' }),
        pb.collection('_externalAuths').getFullList({
          filter: pb.filter('collectionRef = {:id}', { id: usersCollection.id }),
        }),
        pb.collection('app_admins').getFullList({ fields: 'user' }),
      ]);
      const groupCount = countBy(memberships, 'user');
      const gameCount = countBy(games, 'owner');
      const deviceCount = countBy(devices, 'user');
      const panelAdminIds = new Set(panelAdmins.map((a) => a.user));

      return users.map((u) => ({
        id: u.id,
        name: u.name || '',
        email: u.email || '',
        created: u.created,
        providers: externalAuths.filter((e) => e.recordRef === u.id).map((e) => e.provider),
        groups: groupCount[u.id] || 0,
        games: gameCount[u.id] || 0,
        pushDevices: deviceCount[u.id] || 0,
        admin:
          u.email && isFixedAdmin(u.email) ? 'fixed' : panelAdminIds.has(u.id) ? 'panel' : null,
      }));
    },

    // A senha nova derruba as sessões abertas da pessoa e só é mostrada uma vez
    setTemporaryPassword: async (actor: AuthenticatedUser, uid: string): Promise<string> => {
      const pb = await getAdmin();
      const user = await getUser(pb, uid);
      const password = generateTemporaryPassword();
      await pb.collection('users').update(uid, { password, passwordConfirm: password });
      await log(actor, 'senha_temporaria', describe(user));
      return password;
    },

    setAdmin: async (actor: AuthenticatedUser, uid: string, makeAdmin: boolean) => {
      const pb = await getAdmin();
      const user = await getUser(pb, uid);
      if (!makeAdmin && uid === actor.uid) {
        throw new AdminActionError('Você não pode remover o seu próprio acesso de admin.');
      }
      if (!makeAdmin && isFixedAdmin(user.email)) {
        throw new AdminActionError('Este admin é fixo (APP_ADMIN_EMAILS) e não sai pelo painel.');
      }
      const existing = await findPanelAdmin(pb, uid);
      if (makeAdmin && !existing) await pb.collection('app_admins').create({ user: uid });
      if (!makeAdmin && existing) await pb.collection('app_admins').delete(existing.id);
      await log(actor, makeAdmin ? 'admin_concedido' : 'admin_removido', describe(user));
    },

    // Mesmas regras da exclusão feita pela própria pessoa (grupos passam ao membro mais antigo)
    deleteUser: async (actor: AuthenticatedUser, uid: string) => {
      if (uid === actor.uid) {
        throw new AdminActionError('Para excluir a sua própria conta, use a página Conta.');
      }
      const user = await getUser(await getAdmin(), uid);
      await deleteAccount(uid);
      await log(actor, 'conta_excluida', describe(user));
    },

    listGroups: async (): Promise<AdminGroup[]> => {
      const pb = await getAdmin();
      const [groups, memberships, events] = await Promise.all([
        pb.collection('groups').getFullList({ sort: 'name' }),
        pb.collection('memberships').getFullList({ sort: 'created', expand: 'user' }),
        pb.collection('events').getFullList({ fields: 'group' }),
      ]);
      const eventCount = countBy(events, 'group');
      return groups.map((g) => ({
        id: g.id,
        name: g.name,
        adminId: g.admin,
        members: memberships
          .filter((m) => m.group === g.id)
          .map((m) => ({
            id: m.user,
            name: m.nickname || m.expand?.user?.name || m.expand?.user?.email || 'Sem nome',
          })),
        events: eventCount[g.id] || 0,
      }));
    },

    transferGroupAdmin: async (actor: AuthenticatedUser, groupId: string, uid: string) => {
      const pb = await getAdmin();
      const group = await getGroup(pb, groupId);
      const [membership] = await pb.collection('memberships').getFullList({
        filter: pb.filter('group = {:groupId} && user = {:uid}', { groupId, uid }),
        expand: 'user',
      });
      if (!membership) throw new AdminActionError('A pessoa precisa ser membro do grupo.');
      await pb.collection('groups').update(groupId, { admin: uid });
      await log(
        actor,
        'grupo_novo_admin',
        `${group.name}: ${describe(membership.expand?.user ?? {})}`,
      );
    },

    removeMember: async (actor: AuthenticatedUser, groupId: string, uid: string) => {
      const pb = await getAdmin();
      const group = await getGroup(pb, groupId);
      if (group.admin === uid) {
        throw new AdminActionError('Transfira a administração do grupo antes de remover o admin.');
      }
      const [membership] = await pb.collection('memberships').getFullList({
        filter: pb.filter('group = {:groupId} && user = {:uid}', { groupId, uid }),
        expand: 'user',
      });
      if (!membership) throw new AdminActionError('A pessoa não é membro do grupo.', 404);
      await pb.collection('memberships').delete(membership.id);
      await log(
        actor,
        'membro_removido',
        `${group.name}: ${describe(membership.expand?.user ?? {})}`,
      );
    },

    listOpenEvents: async (): Promise<AdminEvent[]> => {
      const pb = await getAdmin();
      const [events, memberships, votes] = await Promise.all([
        pb.collection('events').getFullList({
          filter: "status = 'VOTING_DATE' || status = 'VOTING_GAMES'",
          expand: 'group',
          sort: 'created',
        }),
        pb.collection('memberships').getFullList({ sort: 'created', expand: 'user' }),
        pb.collection('votes').getFullList(),
      ]);
      return events.map((event) => {
        const members = memberships.filter((m) => m.group === event.group);
        const votesFrom = (field: string) =>
          Object.fromEntries(
            votes
              .filter((v) => v.event === event.id && v.user && v[field])
              .map((v) => [v.user, v[field]]),
          );
        const pendingIds = getPendingVoterIds(
          members.map((m) => m.user),
          {
            status: event.status,
            votesDate: votesFrom('dateOptionId'),
            votesGames: votesFrom('gameIds'),
          },
        );
        return {
          id: event.id,
          title: event.title,
          status: event.status,
          groupId: event.group,
          groupName: event.expand?.group?.name ?? '',
          pendingNames: members
            .filter((m) => pendingIds.includes(m.user))
            .map((m) => m.nickname || m.expand?.user?.name || m.expand?.user?.email || 'Sem nome'),
          lastReminderSentAt: event.lastReminderSentAt || '',
        };
      });
    },

    // Cobra agora quem ainda não votou; devolve a mensagem de resumo para o painel
    remindEvent: async (actor: AuthenticatedUser, eventId: string): Promise<string> => {
      const result = await remindEvent(eventId);
      if (!result.ok) {
        throw result.reason === 'EVENT_NOT_FOUND'
          ? new AdminActionError('Evento não encontrado.', 404)
          : new AdminActionError('O evento já foi confirmado.');
      }
      const pb = await getAdmin();
      const event = await pb.collection('events').getOne(eventId, { expand: 'group' });
      await log(
        actor,
        'cobranca_enviada',
        `${event.expand?.group?.name ?? ''}: ${event.title} (${result.notified} de ${result.pending})`,
      );
      return describeReminderOutcome(result.pending, result.notified);
    },

    listLogs: async (): Promise<AdminLog[]> => {
      const pb = await getAdmin();
      const { items } = await pb.collection('admin_logs').getList(1, 100, { sort: '-created' });
      return items.map((l) => ({
        id: l.id,
        actorEmail: l.actorEmail,
        action: l.action,
        details: l.details,
        created: l.created,
      }));
    },
  };
};

export const adminService = createAdminService(
  getAdminClient,
  accountService.deleteAccount,
  () => parseAdminEmails(process.env.APP_ADMIN_EMAILS),
  reminderService.remindEventAsAppAdmin,
);
