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

export const createAccountService = (getAdmin: () => Promise<PocketBase>) => ({
  deleteAccount: async (uid: string): Promise<void> => {
    const pb = await getAdmin();
    const myMemberships = await pb.collection('memberships').getFullList({
      filter: pb.filter('user = {:uid}', { uid }),
      expand: 'group',
    });

    for (const membership of myMemberships) {
      const group = membership.expand!.group;
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
        continue;
      }

      await removeFromOpenEvents(pb, group.id, uid);
      if (departure.adminId !== group.admin) {
        await pb.collection('groups').update(group.id, { admin: departure.adminId });
      }
      await pb.collection('memberships').delete(membership.id);
    }

    // Apaga ludoteca e favoritos em cascata; em eventos encerrados, criador, votos e
    // sugestões ficam sem autor, preservando o histórico
    await pb.collection('users').delete(uid);
  },
});

export const accountService = createAccountService(getAdminClient);
