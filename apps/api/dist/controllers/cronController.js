"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronController = void 0;
const firebase_admin_1 = require("../lib/firebase-admin");
const emailService_1 = require("../services/emailService");
exports.cronController = {
    processReminders: async (req, res) => {
        // Basic auth using an API key passed in headers or query to prevent unauthorized triggering
        const cronKey = req.headers['x-cron-key'] || req.query.key;
        const expectedKey = process.env.CRON_SECRET || 'secret-cron-123';
        if (cronKey !== expectedKey) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        let emailsSentCount = 0;
        try {
            // Procurar todos os grupos
            const groupsSnapshot = await firebase_admin_1.db.collection('groups').get();
            for (const groupDoc of groupsSnapshot.docs) {
                const groupId = groupDoc.id;
                const groupData = groupDoc.data();
                // Pessoas no grupo (nossa modelagem atual não guarda array de membros diretamente no doc de group)
                // Para simplificar, vou buscar nos sub-documentos de convite ou usuários que entraram
                // Mas como a Fase 2 (Grupos) ainda não implementou sub-coleção "members", apenas admins podem estar lá.
                // Vamos supor que existam "membros" armazenados em groupData.members ou que o Event tenha "guests"
                // Wait: Na dashboard o app web busca os grupos pelo uid em user.groups.
                // A API precisaria buscar os usuários que possuem esse grupo.
                const usersSnapshot = await firebase_admin_1.db.collection('users').get();
                const groupMembers = usersSnapshot.docs.filter(u => {
                    const ud = u.data();
                    return ud.groups && ud.groups.includes(groupId);
                });
                if (groupMembers.length === 0)
                    continue;
                // Buscar eventos abertos do grupo
                const eventsSnapshot = await firebase_admin_1.db.collection(`groups/${groupId}/events`).get();
                for (const evDoc of eventsSnapshot.docs) {
                    const evData = evDoc.data();
                    if (evData.status === 'VOTING_DATE' || evData.status === 'VOTING_GAMES') {
                        for (const member of groupMembers) {
                            const memberUid = member.id;
                            const memberEmail = member.data().email;
                            let hasVoted = false;
                            if (evData.status === 'VOTING_DATE') {
                                hasVoted = !!(evData.votesDate && evData.votesDate[memberUid]);
                            }
                            else if (evData.status === 'VOTING_GAMES') {
                                hasVoted = !!(evData.votesGames && evData.votesGames[memberUid]);
                            }
                            if (!hasVoted && memberEmail) {
                                await emailService_1.emailService.sendReminderEmail(memberEmail, evData.title, groupData.name || 'Grupo de Jogatina');
                                emailsSentCount++;
                            }
                        }
                    }
                }
            }
            return res.status(200).json({ success: true, message: `Reminders processed. Sent: ${emailsSentCount}` });
        }
        catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    // Endpoint específico para o admin forçar a notificação via botão do Frontend
    forceRemindersForEvent: async (req, res) => {
        const { groupId, eventId } = req.body;
        // Opcional: verificar token de autenticação aqui
        if (!groupId || !eventId)
            return res.status(400).json({ error: 'Missing parameters' });
        let emailsSentCount = 0;
        try {
            const groupDoc = await firebase_admin_1.db.doc(`groups/${groupId}`).get();
            if (!groupDoc.exists)
                return res.status(404).json({ error: 'Group not found' });
            const groupData = groupDoc.data();
            const evDoc = await firebase_admin_1.db.doc(`groups/${groupId}/events/${eventId}`).get();
            if (!evDoc.exists)
                return res.status(404).json({ error: 'Event not found' });
            const evData = evDoc.data();
            if (evData.status === 'CONFIRMED')
                return res.status(400).json({ error: 'Event is already confirmed' });
            const usersSnapshot = await firebase_admin_1.db.collection('users').get();
            const groupMembers = usersSnapshot.docs.filter(u => {
                const ud = u.data();
                return ud.groups && ud.groups.includes(groupId);
            });
            for (const member of groupMembers) {
                const memberUid = member.id;
                const memberEmail = member.data().email;
                let hasVoted = false;
                if (evData.status === 'VOTING_DATE') {
                    hasVoted = !!(evData.votesDate && evData.votesDate[memberUid]);
                }
                else if (evData.status === 'VOTING_GAMES') {
                    hasVoted = !!(evData.votesGames && evData.votesGames[memberUid]);
                }
                if (!hasVoted && memberEmail) {
                    await emailService_1.emailService.sendReminderEmail(memberEmail, evData.title, groupData.name || 'Grupo de Jogatina');
                    emailsSentCount++;
                }
            }
            return res.status(200).json({ success: true, message: `Sent ${emailsSentCount} reminders.` });
        }
        catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};
