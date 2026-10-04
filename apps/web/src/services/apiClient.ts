const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  idToken?: string;
  body?: unknown;
  // Mensagem usada quando a API não devolve { error }
  fallbackError: string;
}

// Único ponto de chamada à API própria: URL base, autenticação e tratamento de erro
export const apiRequest = async <T>(
  path: string,
  { method = 'GET', idToken, body, fallbackError }: ApiRequestOptions,
): Promise<T> => {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || fallbackError, response.status, data.code);
  return data as T;
};
