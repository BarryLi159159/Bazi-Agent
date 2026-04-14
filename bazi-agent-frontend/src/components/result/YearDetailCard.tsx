import type { YearPrediction } from '../../types';

type DomainKey = 'career' | 'wealth' | 'relationship' | 'health';

const DOMAIN_LABELS_ZH: Record<DomainKey, string> = {
  career: '事业', wealth: '财运', relationship: '感情', health: '健康',
};

const DOMAIN_LABELS_EN: Record<DomainKey, string> = {
  career: 'Career', wealth: 'Wealth', relationship: 'Love', health: 'Health',
};

const DOMAIN_COLORS: Record<DomainKey, string> = {
  career: '#6366f1', wealth: '#f59e0b', relationship: '#ec4899', health: '#10b981',
};

const EVENT_TYPE_ICON: Record<string, string> = {
  opportunity: '✦', risk: '⚠', turning_point: '↻', noble_help: '★',
};

const EVENT_TYPE_ZH: Record<string, string> = {
  opportunity: '机遇', risk: '风险', turning_point: '转折', noble_help: '贵人',
};

const EVENT_TYPE_EN: Record<string, string> = {
  opportunity: 'Opportunity', risk: 'Risk', turning_point: 'Turning point', noble_help: 'Noble help',
};

function ScoreRing(props: { score: number; color: string; size?: number }) {
  const { score, color, size = 56 } = props;
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg width={size} height={size} className="score-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} opacity={0.3} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--ink-0)">{score}</text>
    </svg>
  );
}

export function YearDetailCard(props: {
  t: Record<string, string>;
  yearData: YearPrediction;
  language: string;
  isPeak: boolean;
  isCaution: boolean;
}) {
  const { t, yearData, language, isPeak, isCaution } = props;
  const domainLabels = language === 'en' ? DOMAIN_LABELS_EN : DOMAIN_LABELS_ZH;
  const eventLabels = language === 'en' ? EVENT_TYPE_EN : EVENT_TYPE_ZH;

  return (
    <section className={`panel year-detail-card ${isPeak ? 'year-detail-peak' : ''} ${isCaution ? 'year-detail-caution' : ''}`}>
      <div className="year-detail-header">
        <div className="year-detail-year-badge">
          <span className="year-detail-year">{yearData.year}</span>
          <span className="year-detail-ganzhi">{yearData.liuNianGanZhi}</span>
          {yearData.daYunGanZhi && <span className="year-detail-dayun">{t.predictionDaYun ?? '大运'} {yearData.daYunGanZhi}</span>}
        </div>
        <ScoreRing score={yearData.overallScore} color={isPeak ? '#16a34a' : isCaution ? '#d97706' : '#6366f1'} size={64} />
      </div>

      <div className="year-detail-domains">
        {(Object.keys(DOMAIN_COLORS) as DomainKey[]).map((key) => (
          <div key={key} className="year-detail-domain">
            <ScoreRing score={yearData.domains[key].score} color={DOMAIN_COLORS[key]} size={48} />
            <div className="year-detail-domain-info">
              <strong>{domainLabels[key]}</strong>
              <span>{yearData.domains[key].summary}</span>
            </div>
          </div>
        ))}
      </div>

      {yearData.keyEvents.length > 0 && (
        <div className="year-detail-events">
          {yearData.keyEvents.map((evt, i) => (
            <div key={i} className={`year-detail-event year-detail-event-${evt.type}`}>
              <span className="year-detail-event-icon">{EVENT_TYPE_ICON[evt.type] ?? '•'}</span>
              <span className="year-detail-event-label">{eventLabels[evt.type] ?? evt.type}</span>
              {evt.month && <span className="year-detail-event-month">{evt.month}{language === 'zh' ? '月' : `/${evt.month}`}</span>}
              <span className="year-detail-event-desc">{evt.description}</span>
            </div>
          ))}
        </div>
      )}

      <p className="year-detail-advice">
        <strong>{t.predictionAdvice ?? '建议'}</strong> {yearData.advice}
      </p>
    </section>
  );
}
