import type { Meeting, ChatRequest, ChatResponse } from '../types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new ApiError(response.status, error.detail || 'Request failed');
  }

  return response.json();
}

// Meetings API
export const meetingsApi = {
  list: (organizationId: string): Promise<Meeting[]> =>
    request(`/meetings/?organization_id=${organizationId}`),

  get: (meetingId: string): Promise<Meeting> =>
    request(`/meetings/${meetingId}`),

  create: (organizationId: string, title?: string): Promise<Meeting> =>
    request('/meetings/', {
      method: 'POST',
      body: JSON.stringify({
        organization_id: organizationId,
        title: title || null,
      }),
    }),
};

// Chat API
export const chatApi = {
  send: (data: ChatRequest): Promise<ChatResponse> =>
    request('/chat/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Health check
export const healthApi = {
  check: (): Promise<{ status: string }> =>
    request('/health'),

  checkDb: (): Promise<{ status: string; database: string }> =>
    request('/health/db'),
};

export { ApiError };
