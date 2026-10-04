import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './apiClient';

const mockFetch = (status: number, body?: unknown) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      body === undefined ? Promise.reject(new Error('sem corpo')) : Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('envia token e corpo JSON e devolve a resposta', async () => {
    const fetchMock = mockFetch(200, { groupName: 'Grupo' });

    const data = await apiRequest('/api/groups/join', {
      method: 'POST',
      idToken: 'tok',
      body: { inviteToken: 'abc' },
      fallbackError: 'erro',
    });

    expect(data).toEqual({ groupName: 'Grupo' });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: '{"inviteToken":"abc"}',
    });
  });

  it('GET sem corpo não envia Content-Type', async () => {
    const fetchMock = mockFetch(200, {});
    await apiRequest('/api/games/search', { idToken: 'tok', fallbackError: 'erro' });
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('aceita 204 sem corpo', async () => {
    mockFetch(204);
    await expect(
      apiRequest('/api/account', { method: 'DELETE', fallbackError: 'erro' }),
    ).resolves.toEqual({});
  });

  it('erro usa a mensagem e o código da API', async () => {
    mockFetch(403, { error: 'Login recente necessário.', code: 'requires-recent-login' });
    const err = await apiRequest('/api/account', { fallbackError: 'erro' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      message: 'Login recente necessário.',
      status: 403,
      code: 'requires-recent-login',
    });
  });

  it('erro sem corpo usa a mensagem padrão', async () => {
    mockFetch(500);
    await expect(apiRequest('/x', { fallbackError: 'Erro na busca' })).rejects.toThrow(
      'Erro na busca',
    );
  });
});
