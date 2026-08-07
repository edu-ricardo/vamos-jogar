import { collection, doc, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Group {
  id: string;
  name: string;
  adminId: string;
  inviteToken: string;
}

export const groupService = {
  fetchUserGroups: async (uid: string): Promise<Group[]> => {
    try {
      const q = query(collection(db, 'groups'), where('members', 'array-contains', uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Group[];
    } catch (err) {
      console.error("Erro ao buscar grupos no Firestore:", err);
      throw err;
    }
  },

  updateMemberName: async (groupId: string, userId: string, newName: string): Promise<void> => {
    try {
      const memberRef = doc(db, 'groups', groupId, 'members', userId);
      await setDoc(memberRef, { name: newName }, { merge: true });
    } catch (err) {
      console.error("Erro ao atualizar nome do membro no grupo:", err);
      throw err;
    }
  },

  fetchGroupDetails: async (groupId: string): Promise<Group | null> => {
    try {
      const docRef = doc(db, 'groups', groupId);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;
      return { id: snapshot.id, ...snapshot.data() } as Group;
    } catch (err) {
      console.error("Erro ao buscar detalhes do grupo:", err);
      throw err;
    }
  },

  fetchGroupMembers: async (groupId: string): Promise<{id: string, name: string}[]> => {
    try {
      const snapshot = await getDocs(collection(db, 'groups', groupId, 'members'));
      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Usuário'
      }));
    } catch (err) {
      console.error("Erro ao buscar membros do grupo:", err);
      throw err;
    }
  },

  removeMember: async (groupId: string, userId: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'groups', groupId, 'members', userId));
      
      const groupRef = doc(db, 'groups', groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const data = groupSnap.data();
        const newMembers = (data.members || []).filter((id: string) => id !== userId);
        await updateDoc(groupRef, { members: newMembers });
      }
    } catch (err) {
      console.error("Erro ao remover membro:", err);
      throw err;
    }
  },

  createGroup: async (uid: string, groupName: string): Promise<void> => {
    try {
      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      await addDoc(collection(db, 'groups'), {
        name: groupName,
        adminId: uid,
        members: [uid],
        inviteToken: token,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Erro ao criar grupo no Firestore:", err);
      throw err;
    }
  }
};
