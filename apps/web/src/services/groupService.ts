import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
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
