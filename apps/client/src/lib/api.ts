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
    baseUrl: '',
    headers,
    fetch(path: string, init?: RequestInit) {
      // If body is FormData, let browser set Content-Type with boundary
      const isFormData = init?.body instanceof FormData;
      if (isFormData) {
        const h: Record<string, string> = {};
        if (headers.Authorization) {
          h.Authorization = headers.Authorization;
        }
        return fetch(path, { ...init, headers: h });
      }
      return fetch(path, {
        ...init,
        headers: { ...headers, ...init?.headers },
      });
    },
  };
}
