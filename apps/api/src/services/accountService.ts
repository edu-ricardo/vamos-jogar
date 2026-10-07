import type PocketBase from 'pocketbase/cjs';
import { getAdminClient } from '../lib/pocketbase';
import { planGroupDeparture } from './accountRules';

const OPEN_EVENT = "(event.status = 'VOTING_DATE' || event.status = 'VOTING_GAMES')";

// Eventos encerrados mantêm o histórico; só os abertos perdem votos e sugestões da pessoa
const removeFromOpenEvents = async (pb: PocketBase, groupId: string, uid: string) => {
  const inThisGroup = pb.filter('event.group = {:groupId}', { groupId });
  const votes = await pb.collection('votes').getFullList({
    filter: `${inThisGroup} && ${pb.filter('user = {:uid}', { uid })} && ${OPEN_EVENT}`,
  });
  const suggestions = await pb.collection('event_games').getFullList({
    filter: `${inThisGroup} && ${pb.filter('suggester = {:uid}', { uid })} && ${OPEN_EVENT}`,
  });
  for (const vote of votes) await pb.collection('votes').delete(vote.id);
  for (const suggestion of suggestions) await pb.collection('event_games').delete(suggestion.id);
};

export type LeaveGroupResult =
  { ok: true; groupDeleted: boolean } | { ok: false; reason: 'NOT_MEMBER' };

export const createAccountService = (getAdmin: () => Promise<PocketBase>) => {
  // Tira a pessoa de um grupo: o grupo some se ela era a única, e o membro mais antigo herda a
  // administração se ela era admin. Votos e sugestões só saem dos eventos ainda abertos.
  const leaveGroup = async (
    pb: PocketBase,
    uid: string,
    membership: { id: string },
    group: { id: string; admin: string },
  ): Promise<{ groupDeleted: boolean }> => {
    // Ordem de entrada: o membro mais antigo herda o grupo
    const members = await pb.collection('memberships').getFullList({
      filter: pb.filter('group = {:groupId}', { groupId: group.id }),
      sort: 'created',
    });
    const departure = planGroupDeparture(
      { adminId: group.admin, members: members.map((m) => m.user) },
      uid,
    );

    if (departure.action === 'delete') {
      // Apaga em cascata participações, eventos, votos e sugestões do grupo
      await pb.collection('groups').delete(group.id);
      return { groupDeleted: true };
    }

    await removeFromOpenEvents(pb, group.id, uid);
    if (departure.adminId !== group.admin) {
      await pb.collection('groups').update(group.id, { admin: departure.adminId });
    }
    await pb.collection('memberships').delete(membership.id);
    return { groupDeleted: false };
  };

  return {
    deleteAccount: async (uid: string): Promise<void> => {
      const pb = await getAdmin();
      const myMemberships = await pb.collection('memberships').getFullList({
        filter: pb.filter('user = {:uid}', { uid }),
        expand: 'group',
      });
      for (const membership of myMemberships) {
        await leaveGroup(pb, uid, membership, membership.expand!.group);
      }

      // Apaga ludoteca e favoritos em cascata; em eventos encerrados, criador, votos e
      // sugestões ficam sem autor, preservando o histórico
      await pb.collection('users').delete(uid);
    },

    // A própria pessoa sai de um grupo
    leaveGroup: async (uid: string, groupId: string): Promise<LeaveGroupResult> => {
      const pb = await getAdmin();
      const [membership] = await pb.collection('memberships').getFullList({
        filter: pb.filter('user = {:uid} && group = {:groupId}', { uid, groupId }),
        expand: 'group',
      });
      if (!membership) return { ok: false, reason: 'NOT_MEMBER' };
      return { ok: true, ...(await leaveGroup(pb, uid, membership, membership.expand!.group)) };
    },
  };
};

export const accountService = createAccountService(getAdminClient);
