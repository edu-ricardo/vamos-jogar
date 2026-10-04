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
