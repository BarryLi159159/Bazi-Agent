import type { ChartValidationRecord, UserProfileForm } from '../types';

type Language = 'zh' | 'en';

export function InputStep(props: {
  t: Record<string, string>;
  profile: UserProfileForm;
  calendarType: 'solar' | 'lunar';
  birthDate: string;
  birthTime: string;
  sending: boolean;
  setProfile: (updater: (prev: UserProfileForm) => UserProfileForm) => void;
  setCalendarType: (value: 'solar' | 'lunar') => void;
  setBirthDate: (value: string) => void;
  setBirthTime: (value: string) => void;
  setChartValidationRecords: (updater: (prev: ChartValidationRecord[]) => ChartValidationRecord[]) => void;
  onStart: () => void;
  language: Language;
}) {
  const { t, profile, calendarType, birthDate, birthTime, sending, setProfile, setCalendarType, setBirthDate, setBirthTime, setChartValidationRecords, onStart, language } =
    props;

  function addValidationRow() {
    setChartValidationRecords((prev) => [...prev, { year: null, eventType: '', polarity: '', impactLevel: null }]);
  }

  function updateValidationRow(index: number, patch: Partial<ChartValidationRecord>) {
    setChartValidationRecords((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  function removeValidationRow(index: number) {
    setChartValidationRecords((prev) => prev.filter((_item, idx) => idx !== index));
  }

  return (
    <section className="input-page input-page-hero">
      <div className="input-header">
        <div>
          <h2>{t.profileTitle}</h2>
          <p className="muted">{language === 'zh' ? '填写出生信息后直接生成结果' : 'Fill profile and generate chart result directly'}</p>
        </div>
        <button className="signin-btn" type="button">
          {t.signIn}
        </button>
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
    </section>
  );
}
