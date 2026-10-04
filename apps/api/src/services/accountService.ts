import { DocumentReference, FieldValue } from 'firebase-admin/firestore';
import { db, auth } from '../lib/firebase-admin';
import { planGroupDeparture } from './accountRules';

// Eventos encerrados mantêm o histórico; só os abertos perdem votos e sugestões da pessoa
const removeFromOpenEvents = async (groupRef: DocumentReference, uid: string): Promise<void> => {
  const openEvents = await groupRef
    .collection('events')
    .where('status', 'in', ['VOTING_DATE', 'VOTING_GAMES'])
    .get();

  for (const eventDoc of openEvents.docs) {
    const gameOptions: { suggesterId?: string }[] = eventDoc.data().gameOptions || [];
    await eventDoc.ref.update({
      [`votesDate.${uid}`]: FieldValue.delete(),
      [`votesLocation.${uid}`]: FieldValue.delete(),
      [`votesGames.${uid}`]: FieldValue.delete(),
      gameOptions: gameOptions.filter((game) => game.suggesterId !== uid),
    });
  }
};

export const accountService = {
  deleteAccount: async (uid: string): Promise<void> => {
    const groups = await db.collection('groups').where('members', 'array-contains', uid).get();

    for (const groupDoc of groups.docs) {
      const departure = planGroupDeparture(
        groupDoc.data() as { adminId: string; members?: string[] },
        uid,
      );

      if (departure.action === 'delete') {
        await db.recursiveDelete(groupDoc.ref);
        continue;
      }

      await removeFromOpenEvents(groupDoc.ref, uid);
      await groupDoc.ref.update({ members: departure.members, adminId: departure.adminId });
      await groupDoc.ref.collection('members').doc(uid).delete();
    }

    // Ludoteca, locais favoritos e o documento do usuário
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await auth.deleteUser(uid);
  },
};
