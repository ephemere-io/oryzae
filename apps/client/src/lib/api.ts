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
      const mergedHeaders = isFormData
        ? { Authorization: headers.Authorization ?? '', ...init?.headers }
        : { ...headers, ...init?.headers };
      return fetch(path, {
        ...init,
        headers: mergedHeaders,
      });
    },
  };
}
