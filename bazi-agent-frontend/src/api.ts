import type { ChatResponse, SessionHistoryResponse, SessionsResponse, UserProfileForm, UserResponse } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

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
}): Promise<ChatResponse> {
  const birthSolarDatetime = toIsoWithOffset(params.userProfile.birthSolarDatetime);

  const body = {
    userExternalId: params.userProfile.userExternalId,
    sessionId: params.sessionId,
    message: params.message,
    userProfile: {
      displayName: params.userProfile.displayName,
      gender: params.userProfile.gender,
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
          gender: params.userProfile.gender,
          eightCharProviderSect: 2 as const,
        }
      : undefined,
  };

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Chat request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as ChatResponse;
}

export async function fetchSessions(userExternalId: string): Promise<SessionsResponse> {
  const query = new URLSearchParams({ userExternalId, limit: '50' });
  const response = await fetch(`${API_BASE}/api/sessions?${query.toString()}`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Load sessions failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as SessionsResponse;
}

export async function fetchSessionMessages(sessionId: string): Promise<SessionHistoryResponse> {
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages?limit=80`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Load session failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as SessionHistoryResponse;
}

export async function fetchUserByExternalId(userExternalId: string): Promise<UserResponse | null> {
  const response = await fetch(`${API_BASE}/api/users/${encodeURIComponent(userExternalId)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Load user failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as UserResponse;
}
