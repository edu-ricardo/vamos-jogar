import type PocketBase from 'pocketbase/cjs';
import type { AuthenticatedUser } from './userTokenService';

export type JoinGroupResult =
  | { ok: true; groupId: string; groupName: string }
  | { ok: false; reason: 'INVALID_INVITE' | 'ALREADY_MEMBER' };

// Entrar por convite: só a API (superusuário) cria participações para outras pessoas
export const joinGroupByInvite = async (
  admin: PocketBase,
  inviteToken: string,
  user: AuthenticatedUser,
): Promise<JoinGroupResult> => {
  const [group] = await admin
    .collection('groups')
    .getFullList({ filter: admin.filter('inviteToken = {:inviteToken}', { inviteToken }) });
  if (!group) return { ok: false, reason: 'INVALID_INVITE' };

  const existing = await admin.collection('memberships').getFullList({
    filter: admin.filter('group = {:groupId} && user = {:uid}', {
      groupId: group.id,
      uid: user.uid,
    }),
  });
  if (existing.length > 0) return { ok: false, reason: 'ALREADY_MEMBER' };

  await admin.collection('memberships').create({
    group: group.id,
    user: user.uid,
    nickname: user.name || 'Usuário ' + user.uid.substring(0, 4),
  });
  return { ok: true, groupId: group.id, groupName: group.name };
};
