import { Request, Response } from 'express';
import { db, auth } from '../lib/firebase-admin';

export const joinGroup = async (req: Request, res: Response) => {
  const { inviteToken } = req.body;
  const uid = (req as any).user.uid;

  if (!inviteToken) {
    return res.status(400).json({ error: 'inviteToken é obrigatório.' });
  }

  try {
    const groupsRef = db.collection('groups');
    const snapshot = await groupsRef.where('inviteToken', '==', inviteToken).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Convite inválido ou expirado.' });
    }

    const groupDoc = snapshot.docs[0];
    const groupData = groupDoc.data();

    if (groupData.members && groupData.members.includes(uid)) {
      return res.status(400).json({ error: 'Você já é membro deste grupo.' });
    }

    await groupDoc.ref.update({
      members: [...(groupData.members || []), uid]
    });

    const userRecord = await auth.getUser(uid);
    const userName = userRecord.displayName || 'Usuário ' + uid.substring(0, 4);

    await groupDoc.ref.collection('members').doc(uid).set({
      name: userName
    }, { merge: true });

    return res.json({ success: true, groupId: groupDoc.id, groupName: groupData.name });
  } catch (error) {
    console.error('Erro ao entrar no grupo:', error);
    return res.status(500).json({ error: 'Erro interno ao processar o convite.' });
  }
};
