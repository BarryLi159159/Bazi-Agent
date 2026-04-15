import type { LifePrediction } from '../../types';

type DomainKey = 'career' | 'wealth' | 'relationship' | 'health';

const DOMAIN_COLORS: Record<DomainKey, string> = {
  career: '#6366f1',
  wealth: '#f59e0b',
  relationship: '#ec4899',
  health: '#10b981',
};

const DOMAIN_LABELS_ZH: Record<DomainKey, string> = {
  career: '事业', wealth: '财运', relationship: '感情', health: '健康',
};

const DOMAIN_LABELS_EN: Record<DomainKey, string> = {
  career: 'Career', wealth: 'Wealth', relationship: 'Love', health: 'Health',
};

const DOMAINS: DomainKey[] = ['career', 'wealth', 'relationship', 'health'];

export function PredictionTimeline(props: {
  t: Record<string, string>;
  prediction: LifePrediction;
  language: string;
  selectedYear: number | null;
  onSelectYear: (year: number) => void;
}) {
  const { t, prediction, language, selectedYear, onSelectYear } = props;
  const domainLabels = language === 'en' ? DOMAIN_LABELS_EN : DOMAIN_LABELS_ZH;

  const years = prediction.years;
  if (years.length === 0) return null;

  return (
    <section className="panel prediction-timeline">
      <h3 className="prediction-timeline-title">{t.predictionTimelineTitle ?? '关键年份'}</h3>

      <div className="prediction-year-bars">
        {years.map((y) => {
          const isPeak = prediction.peakYears.includes(y.year);
          const isCaution = prediction.cautionYears.includes(y.year);
          const isSelected = selectedYear === y.year;
          return (
            <button
              key={y.year}
              type="button"
              className={`prediction-year-bar ${isSelected ? 'selected' : ''} ${isPeak ? 'peak' : ''} ${isCaution ? 'caution' : ''}`}
              onClick={() => onSelectYear(y.year)}
            >
              <div className="prediction-year-bar-header">
                <span className="prediction-year-bar-year">{y.year}</span>
                <span className="prediction-year-bar-gz">{y.liuNianGanZhi}</span>
              </div>
              <div className="prediction-year-bar-score">{y.overallScore}</div>
              <div className="prediction-year-bar-meter">
                <div className="prediction-year-bar-fill" style={{ height: `${y.overallScore}%` }} />
              </div>
              <div className="prediction-year-bar-domains">
                {DOMAINS.map((dk) => (
                  <div key={dk} className="prediction-year-bar-domain" title={`${domainLabels[dk]} ${y.domains[dk].score}`}>
                    <div className="prediction-domain-mini-bar" style={{ height: `${y.domains[dk].score}%`, background: DOMAIN_COLORS[dk] }} />
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="prediction-domain-legend">
        {DOMAINS.map((dk) => (
          <span key={dk} className="prediction-domain-legend-item">
            <span className="prediction-domain-dot" style={{ background: DOMAIN_COLORS[dk] }} />
            {domainLabels[dk]}
          </span>
        ))}
      </div>
    </section>
  );
}
