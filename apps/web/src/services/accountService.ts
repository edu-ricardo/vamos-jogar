import { apiRequest } from './apiClient';

export const accountService = {
  // A API remove a pessoa dos grupos, limpa votos abertos, ludoteca, favoritos e o login
  deleteAccount: async (idToken: string): Promise<void> => {
    await apiRequest('/api/account', {
      method: 'DELETE',
      idToken,
      fallbackError: 'Erro ao excluir conta',
    });
  },
};
