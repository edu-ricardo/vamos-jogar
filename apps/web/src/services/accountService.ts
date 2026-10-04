export class AccountError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export const accountService = {
  // A API remove a pessoa dos grupos, limpa votos abertos, ludoteca, favoritos e o login
  deleteAccount: async (idToken: string): Promise<void> => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${API_URL}/api/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new AccountError(data.error || 'Erro ao excluir conta', data.code);
    }
  },
};
