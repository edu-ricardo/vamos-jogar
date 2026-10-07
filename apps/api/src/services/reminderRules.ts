export const REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

export interface EventVotingState {
  status?: string;
  votesDate?: Record<string, string | string[]>;
  votesGames?: Record<string, string[]>;
}

// Datas marcadas num voto: a lista nova (dateOptionIds) ou, em voto feito pela versão anterior
// do app, a data única (dateOptionId)
// (os votos chegam como registros do PocketBase: campos soltos, por isso o tipo aberto)
export const datesOfVote = (vote: Record<string, any>): string[] => {
  if (Array.isArray(vote.dateOptionIds) && vote.dateOptionIds.length > 0) return vote.dateOptionIds;
  return typeof vote.dateOptionId === 'string' && vote.dateOptionId ? [vote.dateOptionId] : [];
};

// Quem já marcou ao menos uma data, com as datas marcadas
export const dateVotesByUser = (votes: Record<string, any>[]): Record<string, string[]> =>
  Object.fromEntries(
    votes
      .filter((v) => v.user && datesOfVote(v).length > 0)
      .map((v) => [v.user as string, datesOfVote(v)]),
  );

// Membros que ainda não votaram na fase atual do evento
export const getPendingVoterIds = (memberIds: string[], event: EventVotingState): string[] => {
  const votes =
    event.status === 'VOTING_DATE'
      ? event.votesDate
      : event.status === 'VOTING_GAMES'
        ? event.votesGames
        : null;

  if (votes === null) return [];
  return memberIds.filter((uid) => !votes?.[uid]);
};

export const isReminderDue = (lastSentAt: Date | undefined, now: Date): boolean =>
  !lastSentAt || now.getTime() - lastSentAt.getTime() >= REMINDER_INTERVAL_MS;

// Resumo para quem cobrou: quantos ainda não votaram e quantos receberam a notificação
export const describeReminderOutcome = (pending: number, notified: number): string => {
  if (pending === 0) return 'Todo mundo já votou.';
  return (
    `Notificação enviada para ${notified} de ${pending} pessoa(s) que ainda não votaram.` +
    (notified < pending ? ' Quem não ativou as notificações não recebe.' : '')
  );
};

// Texto da notificação de voto pendente; ao tocar, abre o próprio evento
export const reminderMessage = (event: {
  id: string;
  title: string;
  status: string;
  group: string;
  groupName?: string;
}) => ({
  title: `Falta o seu voto: ${event.title}`,
  body:
    event.status === 'VOTING_GAMES'
      ? `A galera do ${event.groupName || 'grupo'} está esperando você escolher os jogos.`
      : `A galera do ${event.groupName || 'grupo'} está esperando você votar na data e no local.`,
  url: `/event/${event.group}/${event.id}`,
  tag: `lembrete-${event.id}`,
});
