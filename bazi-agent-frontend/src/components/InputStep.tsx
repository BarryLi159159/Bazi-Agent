import { parseBaziPillars, wuxingClass } from '../baziRecordDisplay';
import type { ChartValidationRecord, SessionSummary, UserProfileForm } from '../types';

type Language = 'zh' | 'en';

export function InputStep(props: {
  t: Record<string, string>;
  profile: UserProfileForm;
  calendarType: 'solar' | 'lunar';
  birthDate: string;
  birthTime: string;
  sending: boolean;
  sessions: SessionSummary[];
  loadingSessions: boolean;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  setProfile: (updater: (prev: UserProfileForm) => UserProfileForm) => void;
  setCalendarType: (value: 'solar' | 'lunar') => void;
  setBirthDate: (value: string) => void;
  setBirthTime: (value: string) => void;
  setChartValidationRecords: (updater: (prev: ChartValidationRecord[]) => ChartValidationRecord[]) => void;
  onStart: () => void;
  language: Language;
}) {
  const {
    t,
    profile,
    calendarType,
    birthDate,
    birthTime,
    sending,
    sessions,
    loadingSessions,
    onSelectSession,
    onDeleteSession,
    setProfile,
    setCalendarType,
    setBirthDate,
    setBirthTime,
    setChartValidationRecords,
    onStart,
    language,
  } = props;

  function addValidationRow() {
    setChartValidationRecords((prev) => [...prev, { year: null, eventType: '', polarity: '', impactLevel: null }]);
  }

  function updateValidationRow(index: number, patch: Partial<ChartValidationRecord>) {
    setChartValidationRecords((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  function removeValidationRow(index: number) {
    setChartValidationRecords((prev) => prev.filter((_item, idx) => idx !== index));
  }

  function formatSolarLabel(iso: string | null | undefined): string {
    if (!iso) {
      return '—';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '—';
    }
    if (language === 'zh') {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(d);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const day = parts.find((p) => p.type === 'day')?.value;
      if (y && m && day) {
        return `阳历${y}年${m}月${day}日`;
      }
    }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  function genderLabel(g: number | null | undefined): string {
    const n = g === null || g === undefined ? NaN : Number(g);
    if (n === 1) {
      return t.male;
    }
    if (n === 0) {
      return t.female;
    }
    return '—';
  }

  return (
    <section className="input-page input-page-hero input-page-with-sidebar">
      <aside className="input-history-panel">
        <h3 className="input-history-title">{t.records}</h3>
        <p className="muted input-history-hint">{t.recordsHint}</p>
        {loadingSessions ? <p className="muted">...</p> : null}
        {!loadingSessions && sessions.length === 0 ? <p className="muted">{t.noCases}</p> : null}
        <div className="input-history-list">
          {sessions.map((s) => {
            const name = s.record_name?.trim() || (language === 'zh' ? '未命名' : 'Untitled');
            const baziText = s.record_bazi?.trim() ?? '';
            const parsed = baziText ? parseBaziPillars(baziText) : null;
            const showSummary =
              !baziText && s.last_message_preview && s.last_message_preview.trim().length > 0;
            return (
              <div key={s.id} className="input-record-card-wrap">
                <button type="button" className="input-record-card" onClick={() => onSelectSession(s.id)}>
                <div className="input-record-fields">
                  <div className="input-record-kv">
                    <span className="input-record-lbl">{t.labelName}</span>
                    <span className="input-record-val input-record-val-strong">{name}</span>
                  </div>
                  <div className="input-record-kv">
                    <span className="input-record-lbl">{t.labelBaziBlock}</span>
                    <div className="input-record-eight" aria-label={t.labelBaziBlock}>
                      {parsed ? (
                        <>
                          <div className="input-record-stems">
                            {parsed.stems.map((c, i) => (
                              <span key={`${s.id}-s-${i}`} className={`input-record-char ${wuxingClass(c, 'stem')}`}>
                                {c}
                              </span>
                            ))}
                          </div>
                          <div className="input-record-branches">
                            {parsed.branches.map((c, i) => (
                              <span key={`${s.id}-b-${i}`} className={`input-record-char ${wuxingClass(c, 'branch')}`}>
                                {c}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <span className="input-record-empty">—</span>
                      )}
                    </div>
                  </div>
                  <div className="input-record-kv input-record-kv-inline">
                    <span className="input-record-lbl">{t.labelGender}</span>
                    <span className="input-record-val">{genderLabel(s.record_gender)}</span>
                  </div>
                  <div className="input-record-kv">
                    <span className="input-record-lbl">{t.labelBirth}</span>
                    <span className="input-record-val input-record-val-date">{formatSolarLabel(s.record_birth_solar)}</span>
                  </div>
                  {showSummary ? (
                    <div className="input-record-kv input-record-kv-summary">
                      <span className="input-record-lbl">{t.recordSummaryLabel}</span>
                      <span className="input-record-val input-record-summary-text">{s.last_message_preview}</span>
                    </div>
                  ) : null}
                </div>
                {s.record_zodiac ? (
                  <div className="input-record-zodiac" title={s.record_zodiac}>
                    <span className="input-record-zodiac-inner">{s.record_zodiac}</span>
                  </div>
                ) : null}
                </button>
                <button
                  type="button"
                  className="input-record-delete"
                  aria-label={t.deleteRecord}
                  title={t.deleteRecord}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="input-main-column">
        <div className="input-header">
          <div className="input-header-center">
            <h2>{t.profileTitle}</h2>
            <p className="muted">{language === 'zh' ? '填写出生信息后直接生成结果' : 'Fill profile and generate chart result directly'}</p>
          </div>
        </div>
        <div className="input-grid">
        <label>
          {t.displayName}
          <input value={profile.displayName} onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))} />
        </label>

        <div className="row-group">
          <span>{t.gender}</span>
          <div className="segmented">
            <button type="button" className={profile.gender === 1 ? 'active' : ''} onClick={() => setProfile((p) => ({ ...p, gender: 1 }))}>
              {t.male}
            </button>
            <button type="button" className={profile.gender === 0 ? 'active' : ''} onClick={() => setProfile((p) => ({ ...p, gender: 0 }))}>
              {t.female}
            </button>
          </div>
        </div>

        <div className="row-group">
          <span>{t.calendarType}</span>
          <div className="segmented">
            <button type="button" className={calendarType === 'solar' ? 'active' : ''} onClick={() => setCalendarType('solar')}>
              {t.solar}
            </button>
            <button type="button" className={calendarType === 'lunar' ? 'active' : ''} onClick={() => setCalendarType('lunar')}>
              {t.lunar}
            </button>
          </div>
        </div>

        <label>
          {t.birthDate}
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
        <label>
          {t.birthTime}
          <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} step={60} required />
        </label>

        <label>
          {t.birthLocation}
          <input value={profile.birthLocation} onChange={(e) => setProfile((p) => ({ ...p, birthLocation: e.target.value }))} required />
        </label>

        <label>
          {t.currentAge}
          <input
            type="number"
            min={0}
            max={120}
            value={profile.currentAge ?? ''}
            onChange={(e) => {
              const value = e.target.value.trim();
              setProfile((p) => ({ ...p, currentAge: value.length > 0 ? Number(value) : null }));
            }}
          />
        </label>

        <label>
          {t.currentYear}
          <input
            type="number"
            min={1900}
            max={2100}
            value={profile.currentYear ?? ''}
            onChange={(e) => {
              const value = e.target.value.trim();
              setProfile((p) => ({ ...p, currentYear: value.length > 0 ? Number(value) : null }));
            }}
          />
        </label>
      </div>

      <section className="validation-panel">
        <div className="validation-head">
          <div>
            <h3>{t.validationTitle}</h3>
            <p className="muted">{t.validationHint}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={addValidationRow}>
            + {t.validationAdd}
          </button>
        </div>
        {profile.chartValidationRecords.length === 0 ? null : (
          <div className="validation-table">
            <div className="validation-row validation-row-head">
              <span>{t.validationYear}</span>
              <span>{t.validationEventType}</span>
              <span>{t.validationPolarity}</span>
              <span>{t.validationImpact}</span>
              <span />
            </div>
            {profile.chartValidationRecords.map((item, index) => (
              <div key={index} className="validation-row">
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  value={item.year ?? ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    updateValidationRow(index, { year: value.length > 0 ? Number(value) : null });
                  }}
                />
                <input value={item.eventType} onChange={(e) => updateValidationRow(index, { eventType: e.target.value })} />
                <select value={item.polarity} onChange={(e) => updateValidationRow(index, { polarity: e.target.value as ChartValidationRecord['polarity'] })}>
                  <option value="">-</option>
                  <option value="good">{t.validationGood}</option>
                  <option value="bad">{t.validationBad}</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={item.impactLevel ?? ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    updateValidationRow(index, { impactLevel: value.length > 0 ? Number(value) : null });
                  }}
                />
                <button type="button" className="ghost-btn danger-btn" onClick={() => removeValidationRow(index)}>
                  {t.validationRemove}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

        <button className="primary-btn" type="button" disabled={sending} onClick={onStart}>
          {sending ? '...' : t.start}
        </button>
      </div>
    </section>
  );
}
