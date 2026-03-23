import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { deleteApiKey, deleteSession, fetchApiKeyStatus, fetchCurrentTransit, fetchCurrentUser, fetchSessionMessages, fetchSessions, saveApiKey, sendChat } from './api';
import { SettingsModal } from './components/SettingsModal';
import { AuthPanel } from './components/AuthPanel';
import { HeaderBar } from './components/HeaderBar';
import { InputStep } from './components/InputStep';
import { LandingPage } from './components/LandingPage';
import { ResultStep } from './components/ResultStep';
import { normalizeChartRich } from './chartRich';
import { getTexts, type Language } from './locales';
import { isSupabaseConfigured, supabase } from './supabase';
import type { ChatResponse, SessionSummary, StructuredAnalysis, TransitSnapshot, UserApiKeyStatus, UserProfileForm, UserRecord } from './types';

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

function readStructuredAnalysis(value: unknown): StructuredAnalysis | null {
  const record = asRecord(value);
  const analysis = asRecord(record?.['analysis']);
  const chartBasis = asRecord(record?.['chartBasis']);
  if (!record || !analysis || !chartBasis) {
    return null;
  }

  const reasoningSummary = Array.isArray(record['reasoningSummary'])
    ? record['reasoningSummary'].filter((item): item is string => typeof item === 'string')
    : [];
  const coreThemes = Array.isArray(analysis['coreThemes'])
    ? analysis['coreThemes'].filter((item): item is string => typeof item === 'string')
    : [];
  const risks = Array.isArray(analysis['risks']) ? analysis['risks'].filter((item): item is string => typeof item === 'string') : [];
  const advice = Array.isArray(analysis['advice']) ? analysis['advice'].filter((item): item is string => typeof item === 'string') : [];
  const timeWindows = Array.isArray(analysis['timeWindows'])
    ? analysis['timeWindows']
        .map((item) => {
          const row = asRecord(item);
          if (!row || typeof row['label'] !== 'string' || typeof row['signal'] !== 'string' || typeof row['note'] !== 'string') {
            return null;
          }
          return {
            label: row['label'],
            signal: row['signal'] as StructuredAnalysis['analysis']['timeWindows'][number]['signal'],
            note: row['note'],
          };
        })
        .filter((item): item is StructuredAnalysis['analysis']['timeWindows'][number] => item !== null)
    : [];

  if (typeof record['intent'] !== 'string' || typeof record['questionSummary'] !== 'string' || typeof record['confidence'] !== 'number') {
    return null;
  }

  return {
    intent: record['intent'] as StructuredAnalysis['intent'],
    questionSummary: record['questionSummary'],
    chartBasis: {
      hasBazi: Boolean(chartBasis['hasBazi']),
      baziSource: typeof chartBasis['baziSource'] === 'string' ? chartBasis['baziSource'] : undefined,
      transitIncluded: Boolean(chartBasis['transitIncluded']),
      transitGeneratedAt: typeof chartBasis['transitGeneratedAt'] === 'string' ? chartBasis['transitGeneratedAt'] : undefined,
    },
    reasoningSummary,
    analysis: {
      coreThemes,
      timeWindows,
      risks,
      advice,
    },
    confidence: record['confidence'],
  };
}

function readChatResponseFromMessage(value: unknown, messageContent: string, sessionId: string): ChatResponse | null {
  const meta = asRecord(value);
  const structured = readStructuredAnalysis(meta?.['structured']);
  if (!meta || !structured) {
    return null;
  }

  return {
    userId: '',
    sessionId,
    assistantMessage: messageContent,
    structured,
    meta: {
      modelProvider: typeof meta['modelProvider'] === 'string' ? meta['modelProvider'] : 'unknown',
      usedFallback: Boolean(meta['usedFallback']),
      baziComputed: Boolean(meta['baziComputed']),
      baziSource: typeof meta['baziSource'] === 'string' ? meta['baziSource'] : undefined,
    },
    baziComputed: Boolean(meta['baziComputed']),
    baziSource: typeof meta['baziSource'] === 'string' ? meta['baziSource'] : undefined,
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
  const [latestChat, setLatestChat] = useState<ChatResponse | null>(null);

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
      setLatestChat(null);
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

  useEffect(() => {
    if (!settingsOpen || !session?.access_token) {
      return;
    }
    void (async () => {
      try {
        const status = await fetchApiKeyStatus(session.access_token);
        setApiKeyStatus(status);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t.loadFailed);
      }
    })();
  }, [settingsOpen, session?.access_token, t.loadFailed]);

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

  async function openSessionFromHistory(_sessionId: string) {
    if (!session?.access_token) {
      setError(t.authRequired);
      return;
    }
    setError(null);
    try {
      const history = await fetchSessionMessages(_sessionId, session.access_token);
      const latestAssistant = [...history.messages].reverse().find((item) => item.role === 'assistant');
      setLatestChat(latestAssistant ? readChatResponseFromMessage(latestAssistant.meta_json, latestAssistant.content, history.sessionId) : null);
      await refreshUser(session.access_token);
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
  }

  async function handleOpenSettings() {
    if (!session?.access_token) {
      setError(t.authRequired);
      return;
    }
    setSettingsOpen(true);
    setError(null);
    try {
      const status = await fetchApiKeyStatus(session.access_token);
      setApiKeyStatus(status);
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
      const status = await fetchApiKeyStatus(session.access_token);
      setApiKeyStatus(status);
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
      setLatestChat(response);
      await refreshSessions(session.access_token);
      await refreshUser(session.access_token);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setSending(false);
    }
  }

  const bazi = asRecord(baziUser?.bazi_json);
  const chartRich = normalizeChartRich(bazi);

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
            transit={transit}
            latestChat={latestChat}
            onEdit={() => setStep('input')}
            onBack={() => setStep('landing')}
          />
        ) : null}

        {error ? <div className="error-banner">{error}</div> : null}
      </main>
    </div>
  );
}
