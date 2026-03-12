import { useEffect, useState } from 'react';
import { fetchSessionMessages, fetchSessions, fetchUserByExternalId, sendChat } from './api';
import { CaseDrawer } from './components/CaseDrawer';
import { HeaderBar } from './components/HeaderBar';
import { InputStep } from './components/InputStep';
import { LandingPage } from './components/LandingPage';
import { ResultStep } from './components/ResultStep';
import { normalizeChartRich } from './chartRich';
import { getTexts, type Language } from './locales';
import type { ChatMessage, SessionSummary, UserProfileForm, UserRecord } from './types';

const DEFAULT_PROFILE: UserProfileForm = {
  userExternalId: 'user_001',
  displayName: 'Li',
  gender: 1,
  birthSolarDatetime: '1998-07-31T14:10',
  birthLocation: '',
  currentAge: null,
  currentYear: new Date().getFullYear(),
  chartValidationRecords: [],
};

const PROFILE_STORAGE_KEY = 'bazi:profile';
const LANGUAGE_STORAGE_KEY = 'bazi:language';
const CASE_RECORDS_STORAGE_KEY = 'bazi:case-records';
type PageStep = 'landing' | 'input' | 'result';

interface CaseRecord {
  id: string;
  name: string;
  gender: 0 | 1;
  bazi: string;
  basic: string;
  createdAt: string;
}

function readProfile(): UserProfileForm {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_PROFILE;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UserProfileForm>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      chartValidationRecords: Array.isArray(parsed.chartValidationRecords) ? parsed.chartValidationRecords : [],
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function readLanguage(): Language {
  const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return raw === 'en' ? 'en' : 'zh';
}

function readCaseRecords(): CaseRecord[] {
  const raw = localStorage.getItem(CASE_RECORDS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as CaseRecord[];
  } catch {
    return [];
  }
}

function formatUpdatedAt(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function App() {
  const [profile, setProfile] = useState<UserProfileForm>(() => readProfile());
  const [language, setLanguage] = useState<Language>(() => readLanguage());
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar');
  const [step, setStep] = useState<PageStep>('landing');
  const [showCases, setShowCases] = useState(false);
  const [caseRecords, setCaseRecords] = useState<CaseRecord[]>(() => readCaseRecords());

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [baziUser, setBaziUser] = useState<UserRecord | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const t = getTexts(language);
  const [birthDate, setBirthDate] = useState(() => profile.birthSolarDatetime.split('T')[0] ?? '1998-07-31');
  const [birthTime, setBirthTime] = useState(() => profile.birthSolarDatetime.split('T')[1] ?? '14:10');

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem(CASE_RECORDS_STORAGE_KEY, JSON.stringify(caseRecords));
  }, [caseRecords]);

  useEffect(() => {
    const composed = `${birthDate}T${birthTime}`;
    setProfile((prev) => ({ ...prev, birthSolarDatetime: composed }));
  }, [birthDate, birthTime]);

  async function refreshSessions(userExternalId: string): Promise<SessionSummary[]> {
    const response = await fetchSessions(userExternalId);
    setSessions(response.sessions);
    return response.sessions;
  }

  async function refreshUser(userExternalId: string): Promise<UserRecord | null> {
    const result = await fetchUserByExternalId(userExternalId);
    const user = result?.user ?? null;
    setBaziUser(user);
    return user;
  }

  useEffect(() => {
    if (!profile.userExternalId.trim()) {
      setSessions([]);
      setActiveSessionId(undefined);
      setMessages([]);
      setBaziUser(null);
      return;
    }

    void (async () => {
      setLoadingSessions(true);
      setError(null);
      try {
        const loaded = await refreshSessions(profile.userExternalId);
        await refreshUser(profile.userExternalId);
        setActiveSessionId((current) => current ?? loaded[0]?.id);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t.loadFailed);
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, [profile.userExternalId, t.loadFailed]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    void (async () => {
      try {
        const history = await fetchSessionMessages(activeSessionId);
        setMessages(history.messages);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t.loadFailed);
      }
    })();
  }, [activeSessionId, t.loadFailed]);

  async function runInitialChart() {
    const messages = t as Record<string, string>;
    if (!birthTime.trim()) {
      setError(messages.requiredBirthTime ?? 'Birth time is required');
      return;
    }
    if (!profile.birthLocation.trim()) {
      setError(messages.requiredBirthLocation ?? 'Birth place is required');
      return;
    }

    setError(null);
    setSending(true);
    try {
      const seedPrompt = language === 'zh' ? '请先根据我的出生信息排盘并做简短解读。' : 'Please generate the Bazi chart first with a brief interpretation.';
      const result = await sendChat({
        userProfile: profile,
        sessionId: undefined,
        message: seedPrompt,
      });
      setActiveSessionId(result.sessionId);
      const history = await fetchSessionMessages(result.sessionId);
      setMessages(history.messages);
      await refreshSessions(profile.userExternalId);
      const freshUser = await refreshUser(profile.userExternalId);
      const bazi = asRecord(freshUser?.bazi_json);
      const chart = normalizeChartRich(bazi);
      const nextRecord: CaseRecord = {
        id: result.sessionId,
        name: profile.displayName || profile.userExternalId,
        gender: profile.gender,
        bazi: chart?.basic.bazi ?? String(bazi?.['八字'] ?? '-'),
        basic: `${chart?.basic.dayMaster ?? String(bazi?.['日主'] ?? '-')}/${chart?.basic.zodiac ?? String(bazi?.['生肖'] ?? '-')}`,
        createdAt: new Date().toISOString(),
      };
      setCaseRecords((prev) => [nextRecord, ...prev.filter((item) => item.id !== nextRecord.id)].slice(0, 30));
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
        onToggleLanguage={() => setLanguage((prev) => (prev === 'zh' ? 'en' : 'zh'))}
      />

      <main className="app-main">
        {step === 'landing' ? (
          <LandingPage
            heroKicker={t.heroKicker}
            heroTitle={t.heroTitle}
            heroLinePrimary={t.heroLinePrimary}
            heroLineAccent={t.heroLineAccent}
            getStarted={t.getStarted}
            onStart={() => setStep('input')}
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
            onEdit={() => setStep('input')}
          />
        ) : null}

        {error ? <div className="error-banner">{error}</div> : null}
      </main>

      <CaseDrawer
        open={showCases}
        t={t}
        cases={caseRecords}
        loading={loadingSessions}
        formatDate={(value) => formatUpdatedAt(value, language)}
        onSelect={(sessionId) => {
          setActiveSessionId(sessionId);
          setStep('result');
          setShowCases(false);
        }}
        onClose={() => setShowCases(false)}
      />
    </div>
  );
}
