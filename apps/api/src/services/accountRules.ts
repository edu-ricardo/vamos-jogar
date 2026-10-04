export const RECENT_LOGIN_WINDOW_MS = 5 * 60 * 1000;

export type GroupDeparture =
  { action: 'delete' } | { action: 'leave'; members: string[]; adminId: string };

// Se a pessoa era a única do grupo, o grupo é apagado; se era admin, o membro mais antigo assume
export const planGroupDeparture = (
  group: { adminId: string; members?: string[] },
  uid: string,
): GroupDeparture => {
  const remaining = (group.members || []).filter((memberId) => memberId !== uid);
  if (remaining.length === 0) return { action: 'delete' };

  return {
    action: 'leave',
    members: remaining,
    adminId: group.adminId === uid ? remaining[0] : group.adminId,
  };
};

// Operações destrutivas exigem login recente, como o Firebase faz no cliente
export const isRecentLogin = (authTimeSeconds: number, now: Date): boolean =>
  now.getTime() - authTimeSeconds * 1000 <= RECENT_LOGIN_WINDOW_MS;
