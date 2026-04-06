import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { deleteApiKey, deleteSession, fetchApiKeyStatus, fetchCurrentTransit, fetchCurrentUser, fetchSessionMessages, fetchSessions, saveApiKey, sendChat } from './api';
import { SettingsModal } from './components/SettingsModal';
import { AuthPanel } from './components/AuthPanel';
import { HeaderBar } from './components/HeaderBar';
import { InputStep } from './components/InputStep';
import { LandingPage } from './components/LandingPage';
import { ResultStep } from './components/ResultStep';
import { normalizeChartRich, type NormalizedChartRich } from './chartRich';
import { getTexts, type Language } from './locales';
import { isSupabaseConfigured, supabase } from './supabase';
import type { ChatMessage, ChatResponseMeta, SessionSummary, StructuredAnalysis, TransitSnapshot, UserApiKeyStatus, UserProfileForm, UserRecord } from './types';

const EMPTY_PROFILE: UserProfileForm = {
  displayName: '',
  gender: null,
  birthSolarDatetime: '',
  birthLocation: '',
  currentAge: null,
  currentYear: null,
  chartValidationRecords: [],
};

const LANGUAGE_STORAGE_KEY = 'bazi:language';
type PageStep = 'landing' | 'input' | 'result';

function readLanguage(): Language {
  const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return raw === 'en' ? 'en' : 'zh';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readExportJson(value: unknown): Record<string, unknown> | null {
  return asRecord(value);
}

function readTransitSnapshot(value: unknown): TransitSnapshot | null {
  const record = asRecord(value);
  if (!record || typeof record.source !== 'string' || typeof record.generatedAt !== 'string' || !Array.isArray(record.layers)) {
    return null;
  }
  return value as TransitSnapshot;
}

function readChartFromExportJson(exportJson: Record<string, unknown> | null): NormalizedChartRich | null {
  const chart = asRecord(exportJson?.chart);
  if (!chart) {
    return null;
  }
  return normalizeChartRich({ chart_rich: chart });
}

function readStructuredAnalysis(value: unknown): StructuredAnalysis | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const finalSummary = asRecord(record.finalSummary);
  const structureType = asRecord(record.structureType);
  const failure = asRecord(record.failure);
  const rescue = asRecord(record.rescue);
  const luckFlow = asRecord(record.luckFlow);

  if (!finalSummary || !structureType || !failure || !rescue || !luckFlow) {
    return null;
  }

  const evidenceSources = Array.isArray(record.evidenceSources) ? record.evidenceSources : [];
  return {
    ...(value as StructuredAnalysis),
    evidenceSources,
  };
}

function readChatResponseMeta(value: unknown): ChatResponseMeta | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (typeof record.modelProvider !== 'string' || typeof record.usedFallback !== 'boolean' || typeof record.baziComputed !== 'boolean') {
    return null;
  }

  return {
    modelProvider: record.modelProvider,
    usedFallback: record.usedFallback,
    baziComputed: record.baziComputed,
    baziSource: typeof record.baziSource === 'string' ? record.baziSource : undefined,
    fallbackErrorCode: typeof record.fallbackErrorCode === 'string' ? record.fallbackErrorCode : undefined,
    fallbackErrorMessage: typeof record.fallbackErrorMessage === 'string' ? record.fallbackErrorMessage : undefined,
  };
}

function extractLatestStructuredResult(messages: ChatMessage[]): {
  assistantMessage: string | null;
  structured: StructuredAnalysis | null;
  meta: ChatResponseMeta | null;
  exportJson: Record<string, unknown> | null;
} {
  let fallbackAssistantMessage: string | null = null;
  let fallbackMeta: ChatResponseMeta | null = null;
  let fallbackExportJson: Record<string, unknown> | null = null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') {
      continue;
    }

    fallbackAssistantMessage ??= message.content;
    const meta = asRecord(message.meta_json);
    fallbackMeta ??= readChatResponseMeta(meta);
    fallbackExportJson ??= readExportJson(meta?.exportJson);
    const structured = readStructuredAnalysis(meta?.structured);
    if (structured) {
      return {
        assistantMessage: message.content,
        structured,
        meta: readChatResponseMeta(meta),
        exportJson: readExportJson(meta?.exportJson),
      };
    }
  }

  return {
    assistantMessage: fallbackAssistantMessage,
    structured: null,
    meta: fallbackMeta,
    exportJson: fallbackExportJson,
  };
}

export function App() {
  const [profile, setProfile] = useState<UserProfileForm>(EMPTY_PROFILE);
  const [language, setLanguage] = useState<Language>(() => readLanguage());
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar');
  const [step, setStep] = useState<PageStep>('landing');

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [baziUser, setBaziUser] = useState<UserRecord | null>(null);
  const [transit, setTransit] = useState<TransitSnapshot | null>(null);
  const [latestStructured, setLatestStructured] = useState<StructuredAnalysis | null>(null);
  const [latestAssistantMessage, setLatestAssistantMessage] = useState<string | null>(null);
  const [latestChatMeta, setLatestChatMeta] = useState<ChatResponseMeta | null>(null);
  const [latestExportJson, setLatestExportJson] = useState<Record<string, unknown> | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authSending, setAuthSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<UserApiKeyStatus | null>(null);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyDeleting, setApiKeyDeleting] = useState(false);
  const t = getTexts(language);
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (birthDate && birthTime) {
      setProfile((prev) => ({ ...prev, birthSolarDatetime: `${birthDate}T${birthTime}` }));
    } else {
      setProfile((prev) => ({ ...prev, birthSolarDatetime: '' }));
    }
  }, [birthDate, birthTime]);

  useEffect(() => {
    if (step !== 'input') {
      return;
    }
    setProfile({ ...EMPTY_PROFILE });
    setBirthDate('');
    setBirthTime('');
    setCalendarType('solar');
  }, [step]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      setError(null);
      if (nextSession) {
        setAuthMessage(null);
        return;
      }
      setSessions([]);
      setBaziUser(null);
      setTransit(null);
      setLatestStructured(null);
      setLatestAssistantMessage(null);
      setLatestChatMeta(null);
      setLatestExportJson(null);
      setActiveSessionId(null);
      setChatMessages([]);
      setChatDraft('');
      setApiKeyStatus(null);
      setSettingsOpen(false);
      setStep('landing');
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function refreshSessions(accessToken: string): Promise<SessionSummary[]> {
    const response = await fetchSessions(accessToken);
    setSessions(response.sessions);
    return response.sessions;
  }

  async function refreshUser(accessToken: string): Promise<UserRecord | null> {
    const result = await fetchCurrentUser(accessToken);
    const user = result?.user ?? null;
    setBaziUser(user);
    return user;
  }

  async function refreshApiStatus(accessToken: string): Promise<UserApiKeyStatus | null> {
    const status = await fetchApiKeyStatus(accessToken);
    setApiKeyStatus(status);
    return status;
  }

  useEffect(() => {
    if (!settingsOpen || !session?.access_token) {
      return;
    }
    void (async () => {
      try {
        await refreshApiStatus(session.access_token);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t.loadFailed);
      }
    })();
  }, [settingsOpen, session?.access_token, t.loadFailed]);

  useEffect(() => {
    if (!session?.access_token) {
      setApiKeyStatus(null);
      return;
    }
    void (async () => {
      try {
        await refreshApiStatus(session.access_token);
      } catch {
        setApiKeyStatus(null);
      }
    })();
  }, [session?.access_token]);

  useEffect(() => {
    if (step === 'landing' || !session?.access_token) {
      return;
    }
    void (async () => {
      setLoadingSessions(true);
      setError(null);
      try {
        await refreshSessions(session.access_token);
        await refreshUser(session.access_token);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t.loadFailed);
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, [session?.access_token, step, t.loadFailed]);

  useEffect(() => {
    if (step !== 'result' || !session?.access_token) {
      setTransit(null);
      return;
    }
    void (async () => {
      try {
        const response = await fetchCurrentTransit(session.access_token);
        setTransit(response.transit);
      } catch {
        setTransit(null);
      }
    })();
  }, [session?.access_token, step]);

  async function syncSessionConversation(sessionId: string, accessToken: string): Promise<void> {
    const history = await fetchSessionMessages(sessionId, accessToken);
    const restored = extractLatestStructuredResult(history.messages);
    setActiveSessionId(sessionId);
    setChatMessages(history.messages.filter((message) => message.role !== 'system'));
    setLatestStructured(restored.structured);
    setLatestAssistantMessage(restored.assistantMessage);
    setLatestChatMeta(restored.meta);
    setLatestExportJson(restored.exportJson);
  }

  async function openSessionFromHistory(_sessionId: string) {
    if (!session?.access_token) {
      setError(t.authRequired);
      return;
    }
    setError(null);
    try {
      await syncSessionConversation(_sessionId, session.access_token);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t.loadFailed);
    }
    setStep('result');
  }

  async function handleDeleteSession(sessionId: string) {
    if (!session?.access_token) {
      setError(t.authRequired);
      return;
    }
    const confirm = t as Record<string, string>;
    if (!window.confirm(confirm.confirmDeleteRecord ?? 'Delete?')) {
      return;
    }
    setError(null);
    try {
      await deleteSession(sessionId, session.access_token);
      await refreshSessions(session.access_token);
      await refreshUser(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    }
  }

  async function handleSendMagicLink() {
    if (!supabase || !isSupabaseConfigured) {
      setAuthMessage(t.authMissingConfig);
      return;
    }
    const email = authEmail.trim();
    if (!email) {
      setAuthMessage(t.authEmailPlaceholder);
      return;
    }
    setAuthSending(true);
    setAuthMessage(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (signInError) {
        throw signInError;
      }
      setAuthMessage(t.authCheckInbox);
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setAuthSending(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    setProfile({ ...EMPTY_PROFILE });
    setBirthDate('');
    setBirthTime('');
    setCalendarType('solar');
    setError(null);
    setAuthMessage(null);
    setApiKeyDraft('');
    setLatestStructured(null);
    setLatestAssistantMessage(null);
    setLatestChatMeta(null);
    setLatestExportJson(null);
    setActiveSessionId(null);
    setChatMessages([]);
    setChatDraft('');
  }

  async function handleOpenSettings() {
    if (!session?.access_token) {
      setError(t.authRequired);
      return;
    }
    setSettingsOpen(true);
    setError(null);
    try {
      await refreshApiStatus(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    }
  }

  async function handleSaveApiKey() {
    if (!session?.access_token) {
      setError(t.authRequired);
      return;
    }
    const value = apiKeyDraft.trim();
    if (!value) {
      return;
    }
    setApiKeySaving(true);
    setError(null);
    try {
      await saveApiKey(session.access_token, value);
      await refreshApiStatus(session.access_token);
      setApiKeyDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setApiKeySaving(false);
    }
  }

  async function handleDeleteApiKey() {
    if (!session?.access_token) {
      setError(t.authRequired);
      return;
    }
    setApiKeyDeleting(true);
    setError(null);
    try {
      await deleteApiKey(session.access_token);
      setApiKeyStatus({ provider: 'openai', hasKey: false, last4: null });
      setApiKeyDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setApiKeyDeleting(false);
    }
  }

  async function runInitialChart() {
    if (!session?.access_token) {
      setError(t.authRequired);
      return;
    }
    const messagesDict = t as Record<string, string>;
    if (profile.gender === null) {
      setError(messagesDict.requiredGender ?? 'Please select gender');
      return;
    }
    if (!birthDate.trim()) {
      setError(messagesDict.requiredBirthDate ?? 'Birth date is required');
      return;
    }
    if (!birthTime.trim()) {
      setError(messagesDict.requiredBirthTime ?? 'Birth time is required');
      return;
    }
    if (!profile.birthLocation.trim()) {
      setError(messagesDict.requiredBirthLocation ?? 'Birth place is required');
      return;
    }

    setError(null);
    setSending(true);
    try {
      const seedPrompt = language === 'zh' ? '请先根据我的出生信息排盘并做简短解读。' : 'Please generate the Bazi chart first with a brief interpretation.';
      const response = await sendChat({
        userProfile: profile,
        sessionId: undefined,
        message: seedPrompt,
        accessToken: session.access_token,
      });
      await syncSessionConversation(response.sessionId, session.access_token);
      await refreshSessions(session.access_token);
      await refreshUser(session.access_token);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setSending(false);
    }
  }

  async function handleSendFollowUp() {
    if (!session?.access_token) {
      setError(t.authRequired);
      return;
    }
    if (!activeSessionId) {
      setError(t.diagnosisChatMissingSession ?? '当前会话还未准备好。');
      return;
    }

    const message = chatDraft.trim();
    if (!message) {
      return;
    }

    setChatSending(true);
    setError(null);
    try {
      await sendChat({
        sessionId: activeSessionId,
        message,
        accessToken: session.access_token,
      });
      setChatDraft('');
      await syncSessionConversation(activeSessionId, session.access_token);
      await refreshSessions(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setChatSending(false);
    }
  }

  const bazi = asRecord(baziUser?.bazi_json);
  const currentChartRich = normalizeChartRich(bazi);
  const historyChartRich = readChartFromExportJson(latestExportJson);
  const chartRich = historyChartRich ?? currentChartRich;
  const historyTransit = readTransitSnapshot(latestExportJson?.transit);
  const resultTransit = historyTransit ?? transit;

  return (
    <div className="app-root">
      <HeaderBar
        title={t.appTitle}
        subtitle={t.appSubtitle}
        language={language}
        userEmail={session?.user.email ?? null}
        settingsLabel={t.settings}
        signOutLabel={t.signOut}
        onOpenSettings={() => void handleOpenSettings()}
        onSignOut={() => void handleSignOut()}
        onToggleLanguage={() => setLanguage((prev) => (prev === 'zh' ? 'en' : 'zh'))}
      />

      {settingsOpen && session ? (
        <SettingsModal
          t={t}
          session={session}
          value={apiKeyDraft}
          status={apiKeyStatus}
          saving={apiKeySaving}
          deleting={apiKeyDeleting}
          onChange={setApiKeyDraft}
          onSave={() => void handleSaveApiKey()}
          onDelete={() => void handleDeleteApiKey()}
          onSignOut={() => void handleSignOut()}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      <main className="app-main">
        {authReady && !session ? (
          <AuthPanel
            t={t}
            email={authEmail}
            loading={authSending}
            message={authMessage}
            configured={isSupabaseConfigured}
            onEmailChange={setAuthEmail}
            onSubmit={() => void handleSendMagicLink()}
          />
        ) : null}

        {step === 'landing' ? (
          <LandingPage
            heroKicker={t.heroKicker}
            heroTitle={t.heroTitle}
            heroLinePrimary={t.heroLinePrimary}
            heroLineAccent={t.heroLineAccent}
            getStarted={t.getStarted}
            onStart={() => {
              if (!session?.access_token) {
                setError(t.authRequired);
                return;
              }
              setStep('input');
            }}
          />
        ) : null}

        {step === 'input' ? (
          <InputStep
            t={t}
            profile={profile}
            calendarType={calendarType}
            birthDate={birthDate}
            birthTime={birthTime}
            sending={sending}
            sessions={sessions}
            loadingSessions={loadingSessions}
            onSelectSession={(sessionId) => void openSessionFromHistory(sessionId)}
            onDeleteSession={(sessionId) => void handleDeleteSession(sessionId)}
            setProfile={setProfile}
            setCalendarType={setCalendarType}
            setBirthDate={setBirthDate}
            setBirthTime={setBirthTime}
            setChartValidationRecords={(updater) => {
              setProfile((prev) => ({ ...prev, chartValidationRecords: updater(prev.chartValidationRecords) }));
            }}
            onStart={() => void runInitialChart()}
            language={language}
          />
        ) : null}

        {step === 'result' ? (
          <ResultStep
            t={t}
            chart={chartRich}
            transit={resultTransit}
            structuredAnalysis={latestStructured}
            assistantMessage={latestAssistantMessage}
            chatMeta={latestChatMeta}
            exportJson={latestExportJson}
            hasApiKey={Boolean(apiKeyStatus?.hasKey)}
            chatMessages={chatMessages}
            chatDraft={chatDraft}
            chatSending={chatSending}
            onChatDraftChange={setChatDraft}
            onChatSubmit={() => void handleSendFollowUp()}
            onOpenSettings={() => void handleOpenSettings()}
            onEdit={() => setStep('input')}
            onBack={() => setStep('landing')}
          />
        ) : null}

        {error ? <div className="error-banner">{error}</div> : null}
      </main>
    </div>
  );
}
