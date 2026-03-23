import type { ChatResponse, SessionHistoryResponse, SessionsResponse, TransitResponse, UserApiKeyStatus, UserProfileForm, UserResponse } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function toIsoWithOffset(localDateTime: string): string | undefined {
  if (!localDateTime) {
    return undefined;
  }

  // Treat UI input as China Standard Time wall-clock (UTC+08:00).
  // This keeps "08:00" as exactly "08:00" for Bazi calculation, regardless of browser locale.
  const match = localDateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return undefined;
  }
  const seconds = match[3] ?? '00';
  return `${match[1]}T${match[2]}:${seconds}+08:00`;
}

export async function sendChat(params: {
  userProfile: UserProfileForm;
  sessionId?: string;
  message: string;
  accessToken: string;
}): Promise<ChatResponse> {
  const birthSolarDatetime = toIsoWithOffset(params.userProfile.birthSolarDatetime);

  const body = {
    sessionId: params.sessionId,
    message: params.message,
    userProfile: {
      displayName: params.userProfile.displayName,
      gender: params.userProfile.gender ?? undefined,
      birthSolarDatetime,
      extra: {
        birthLocation: params.userProfile.birthLocation,
        currentAge: params.userProfile.currentAge,
        currentYear: params.userProfile.currentYear,
        chartValidationRecords: params.userProfile.chartValidationRecords,
      },
    },
    baziInput: birthSolarDatetime
      ? {
          solarDatetime: birthSolarDatetime,
          gender: params.userProfile.gender ?? undefined,
          eightCharProviderSect: 2 as const,
        }
      : undefined,
  };

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(params.accessToken),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Chat request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as ChatResponse;
}

export async function fetchSessions(accessToken: string): Promise<SessionsResponse> {
  const query = new URLSearchParams({ limit: '50' });
  const response = await fetch(`${API_BASE}/api/sessions?${query.toString()}`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Load sessions failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as SessionsResponse;
}

export async function deleteSession(sessionId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Delete session failed (${response.status}): ${detail}`);
  }
}

export async function fetchSessionMessages(sessionId: string, accessToken: string): Promise<SessionHistoryResponse> {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages?limit=80`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Load session failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as SessionHistoryResponse;
}

export async function fetchCurrentUser(accessToken: string): Promise<UserResponse> {
  const response = await fetch(`${API_BASE}/api/users/me`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Load user failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as UserResponse;
}

export async function fetchCurrentTransit(accessToken: string): Promise<TransitResponse> {
  const response = await fetch(`${API_BASE}/api/users/me/transit`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Load transit failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as TransitResponse;
}

export async function fetchApiKeyStatus(accessToken: string): Promise<UserApiKeyStatus> {
  const response = await fetch(`${API_BASE}/api/users/me/api-key`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Load API key status failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as UserApiKeyStatus;
}

export async function saveApiKey(accessToken: string, apiKey: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/users/me/api-key`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Save API key failed (${response.status}): ${detail}`);
  }
}

export async function deleteApiKey(accessToken: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/users/me/api-key`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Delete API key failed (${response.status}): ${detail}`);
  }
}
