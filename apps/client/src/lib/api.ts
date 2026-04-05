const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface ApiClient {
  baseUrl: string;
  headers: Record<string, string>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

export function createApiClient(accessToken?: string): ApiClient {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return {
    baseUrl: BASE_URL,
    headers,
    fetch(path: string, init?: RequestInit) {
      return fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: { ...headers, ...init?.headers },
      });
    },
  };
}
