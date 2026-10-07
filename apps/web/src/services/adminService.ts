import { apiRequest } from './apiClient';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  created: string;
  // Provedores externos (ex.: google); vazio = só e-mail e senha
  providers: string[];
  groups: number;
  games: number;
  pushDevices: number;
  // fixed = APP_ADMIN_EMAILS no servidor; panel = acesso dado pelo painel
  admin: 'fixed' | 'panel' | null;
}

export interface AdminGroup {
  id: string;
  name: string;
  adminId: string;
  members: { id: string; name: string }[];
  events: number;
}

export interface AdminEvent {
  id: string;
  title: string;
  status: 'VOTING_DATE' | 'VOTING_GAMES';
  groupId: string;
  groupName: string;
  // Quem ainda não votou na etapa atual
  pendingNames: string[];
  // Vazio se nunca houve lembrete
  lastReminderSentAt: string;
}

export interface AdminLog {
  id: string;
  actorEmail: string;
  action: string;
  details: string;
  created: string;
}

// Painel de admin do app: tudo passa pela API, que confere se quem chama é admin
export const adminService = {
  isAdmin: async (idToken: string): Promise<boolean> =>
    (
      await apiRequest<{ isAdmin: boolean }>('/api/admin/status', {
        idToken,
        fallbackError: 'Erro ao verificar acesso de admin.',
      })
    ).isAdmin,

  listUsers: (idToken: string) =>
    apiRequest<AdminUser[]>('/api/admin/users', {
      idToken,
      fallbackError: 'Erro ao carregar usuários.',
    }),

  setTemporaryPassword: async (idToken: string, userId: string): Promise<string> =>
    (
      await apiRequest<{ password: string }>(`/api/admin/users/${userId}/temporary-password`, {
        method: 'POST',
        idToken,
        fallbackError: 'Erro ao gerar a senha temporária.',
      })
    ).password,

  setAdmin: (idToken: string, userId: string, isAdmin: boolean) =>
    apiRequest(`/api/admin/users/${userId}/admin`, {
      method: 'POST',
      idToken,
      body: { isAdmin },
      fallbackError: 'Erro ao alterar o acesso de admin.',
    }),

  deleteUser: (idToken: string, userId: string) =>
    apiRequest(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      idToken,
      fallbackError: 'Erro ao excluir a conta.',
    }),

  listGroups: (idToken: string) =>
    apiRequest<AdminGroup[]>('/api/admin/groups', {
      idToken,
      fallbackError: 'Erro ao carregar grupos.',
    }),

  transferGroupAdmin: (idToken: string, groupId: string, userId: string) =>
    apiRequest(`/api/admin/groups/${groupId}/admin`, {
      method: 'POST',
      idToken,
      body: { userId },
      fallbackError: 'Erro ao trocar o admin do grupo.',
    }),

  removeMember: (idToken: string, groupId: string, userId: string) =>
    apiRequest(`/api/admin/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
      idToken,
      fallbackError: 'Erro ao remover o membro.',
    }),

  listEvents: (idToken: string) =>
    apiRequest<AdminEvent[]>('/api/admin/events', {
      idToken,
      fallbackError: 'Erro ao carregar eventos.',
    }),

  // Devolve o resumo para mostrar a quem cobrou ("Notificação enviada para 2 de 3...")
  remindEvent: async (idToken: string, eventId: string): Promise<string> =>
    (
      await apiRequest<{ message: string }>(`/api/admin/events/${eventId}/reminders`, {
        method: 'POST',
        idToken,
        fallbackError: 'Erro ao cobrar os votos.',
      })
    ).message,

  listLogs: (idToken: string) =>
    apiRequest<AdminLog[]>('/api/admin/logs', {
      idToken,
      fallbackError: 'Erro ao carregar o registro.',
    }),
};
