"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinGroup = void 0;
const firebase_admin_1 = require("../lib/firebase-admin");
const joinGroup = async (req, res) => {
    const { inviteToken } = req.body;
    const uid = req.user.uid;
    if (!inviteToken) {
        return res.status(400).json({ error: 'inviteToken é obrigatório.' });
    }
    try {
        const groupsRef = firebase_admin_1.db.collection('groups');
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
        return res.json({ success: true, groupId: groupDoc.id, groupName: groupData.name });
    }
    catch (error) {
        console.error('Erro ao entrar no grupo:', error);
        return res.status(500).json({ error: 'Erro interno ao processar o convite.' });
    }
};
exports.joinGroup = joinGroup;
