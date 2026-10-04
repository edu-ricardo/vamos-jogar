import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import type { Group, GroupMember, GroupRepository } from '../groupService';

const toGroup = (record: RecordModel): Group => ({
  id: record.id,
  name: record.name,
  adminId: record.admin,
  inviteToken: record.inviteToken,
});

export const createPocketBaseGroupRepository = (pb: PocketBase): GroupRepository => {
  const findMembership = (groupId: string, userId: string) =>
    pb
      .collection('memberships')
      .getFirstListItem(pb.filter('group = {:groupId} && user = {:userId}', { groupId, userId }));

  return {
    fetchUserGroups: async (uid) => {
      const memberships = await pb.collection('memberships').getFullList({
        filter: pb.filter('user = {:uid}', { uid }),
        expand: 'group',
      });
      return memberships.map((m) => toGroup(m.expand!.group));
    },

    updateMemberName: async (groupId, userId, newName) => {
      const membership = await findMembership(groupId, userId);
      await pb.collection('memberships').update(membership.id, { nickname: newName });
    },

    fetchGroupDetails: async (groupId) => {
      try {
        return toGroup(await pb.collection('groups').getOne(groupId));
      } catch (err) {
        if ((err as { status?: number }).status === 404) return null;
        throw err;
      }
    },

    fetchGroupMembers: async (groupId): Promise<GroupMember[]> => {
      const memberships = await pb.collection('memberships').getFullList({
        filter: pb.filter('group = {:groupId}', { groupId }),
        sort: 'created',
      });
      return memberships.map((m) => ({ id: m.user, name: m.nickname || 'Usuário' }));
    },

    removeMember: async (groupId, userId) => {
      const membership = await findMembership(groupId, userId);
      await pb.collection('memberships').delete(membership.id);
    },

    createGroup: async (uid, groupName, userName) => {
      const group = await pb.collection('groups').create({
        name: groupName,
        admin: uid,
        inviteToken: crypto.randomUUID(),
      });
      await pb
        .collection('memberships')
        .create({ group: group.id, user: uid, nickname: userName || 'Admin' });
    },
  };
};
