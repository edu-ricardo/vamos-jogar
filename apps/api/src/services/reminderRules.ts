export const REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

export interface EventVotingState {
  status?: string;
  votesDate?: Record<string, string>;
  votesGames?: Record<string, string[]>;
}

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
