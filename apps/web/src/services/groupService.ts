import { db } from '../lib/firebase';
import { apiRequest } from './apiClient';
import { createFirebaseGroupRepository } from './firebase/groupRepository';

export interface Group {
  id: string;
  name: string;
  adminId: string;
  inviteToken: string;
}

export interface GroupMember {
  id: string;
  name: string;
}

// Acesso aos dados de grupos; a implementação atual é o Firestore, trocável por outro backend
export interface GroupRepository {
  fetchUserGroups(uid: string): Promise<Group[]>;
  updateMemberName(groupId: string, userId: string, newName: string): Promise<void>;
  fetchGroupDetails(groupId: string): Promise<Group | null>;
  fetchGroupMembers(groupId: string): Promise<GroupMember[]>;
  removeMember(groupId: string, userId: string): Promise<void>;
  createGroup(uid: string, groupName: string, userName?: string): Promise<void>;
}

export const groupService = {
  ...createFirebaseGroupRepository(db),

  // Entrar por convite passa pela API, que valida o token e adiciona o membro
  joinGroup: (inviteToken: string, idToken: string) =>
    apiRequest<{ groupId: string; groupName: string }>('/api/groups/join', {
      method: 'POST',
      idToken,
      body: { inviteToken },
      fallbackError: 'Erro ao processar o convite.',
    }),
};
