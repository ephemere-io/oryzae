import { clearTokens, getRefreshToken, setTokens } from '@/lib/auth';

export interface ApiClient {
  baseUrl: string;
  headers: Record<string, string>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const data = (await res.json()) as {
    session: { accessToken: string; refreshToken: string };
  };
  setTokens(data.session.accessToken, data.session.refreshToken);
  return data.session.accessToken;
}

export function createApiClient(accessToken?: string): ApiClient {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  async function doFetch(path: string, init?: RequestInit): Promise<Response> {
    const isFormData = init?.body instanceof FormData;
    const requestHeaders = isFormData
      ? (() => {
          const h: Record<string, string> = {};
          if (headers.Authorization) h.Authorization = headers.Authorization;
          return h;
        })()
      : { ...headers, ...init?.headers };

    const res = await fetch(path, { ...init, headers: requestHeaders });

    // Don't retry auth endpoints to avoid loops
    if (res.status !== 401 || path.startsWith('/api/v1/auth/')) return res;

    const newToken = await tryRefreshToken();
    if (!newToken) return res;

    headers.Authorization = `Bearer ${newToken}`;
    const retryHeaders = isFormData
      ? { Authorization: `Bearer ${newToken}` }
      : { ...headers, ...init?.headers };

    return fetch(path, { ...init, headers: retryHeaders });
  }

  return {
    baseUrl: '',
    headers,
    fetch: doFetch,
  };
}
