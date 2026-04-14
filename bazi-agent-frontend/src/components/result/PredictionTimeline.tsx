import { useState } from 'react';
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

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function PredictionTimeline(props: {
  t: Record<string, string>;
  prediction: LifePrediction;
  language: string;
  selectedYear: number | null;
  onSelectYear: (year: number) => void;
}) {
  const { t, prediction, language, selectedYear, onSelectYear } = props;
  const [activeDomains, setActiveDomains] = useState<Set<DomainKey | 'overall'>>(new Set(['overall']));
  const domainLabels = language === 'en' ? DOMAIN_LABELS_EN : DOMAIN_LABELS_ZH;

  const years = prediction.years;
  if (years.length === 0) return null;

  const W = 700;
  const H = 260;
  const PAD_L = 36;
  const PAD_R = 16;
  const PAD_T = 20;
  const PAD_B = 36;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const xScale = (i: number) => PAD_L + (plotW / (years.length - 1 || 1)) * i;
  const yScale = (v: number) => PAD_T + plotH - (clamp(v, 0, 100) / 100) * plotH;

  function buildPath(values: number[]): string {
    return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');
  }

  const overallScores = years.map((y) => y.overallScore);

  function toggleDomain(key: DomainKey | 'overall') {
    setActiveDomains((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <section className="panel prediction-timeline">
      <h3 className="prediction-timeline-title">{t.predictionTimelineTitle ?? '运势时间线'}</h3>

      <div className="prediction-legend">
        <button
          type="button"
          className={`prediction-legend-btn ${activeDomains.has('overall') ? 'active' : ''}`}
          style={{ '--legend-color': '#334155' } as React.CSSProperties}
          onClick={() => toggleDomain('overall')}
        >
          {t.predictionOverall ?? '总分'}
        </button>
        {(Object.keys(DOMAIN_COLORS) as DomainKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`prediction-legend-btn ${activeDomains.has(key) ? 'active' : ''}`}
            style={{ '--legend-color': DOMAIN_COLORS[key] } as React.CSSProperties}
            onClick={() => toggleDomain(key)}
          >
            {domainLabels[key]}
          </button>
        ))}
      </div>

      <svg className="prediction-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* grid lines */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={yScale(v)} x2={W - PAD_R} y2={yScale(v)} stroke="var(--line)" strokeWidth={0.6} strokeDasharray={v === 50 ? '4 2' : '2 2'} opacity={0.5} />
            <text x={PAD_L - 6} y={yScale(v) + 4} textAnchor="end" fontSize={10} fill="var(--ink-2)">{v}</text>
          </g>
        ))}

        {/* domain curves */}
        {(Object.keys(DOMAIN_COLORS) as DomainKey[]).map((key) =>
          activeDomains.has(key) ? (
            <path key={key} d={buildPath(years.map((y) => y.domains[key].score))} fill="none" stroke={DOMAIN_COLORS[key]} strokeWidth={1.8} strokeLinejoin="round" opacity={0.7} />
          ) : null,
        )}

        {/* overall curve */}
        {activeDomains.has('overall') && (
          <path d={buildPath(overallScores)} fill="none" stroke="#334155" strokeWidth={2.4} strokeLinejoin="round" />
        )}

        {/* dots & year labels */}
        {years.map((y, i) => {
          const cx = xScale(i);
          const cy = yScale(y.overallScore);
          const isPeak = prediction.peakYears.includes(y.year);
          const isCaution = prediction.cautionYears.includes(y.year);
          const isSelected = selectedYear === y.year;
          return (
            <g key={y.year} className="prediction-chart-dot-group" onClick={() => onSelectYear(y.year)} style={{ cursor: 'pointer' }}>
              {isPeak && <circle cx={cx} cy={cy} r={12} fill="#dcfce7" opacity={0.5} />}
              {isCaution && <circle cx={cx} cy={cy} r={12} fill="#fef3c7" opacity={0.5} />}
              <circle cx={cx} cy={cy} r={isSelected ? 5.5 : 4} fill={isPeak ? '#16a34a' : isCaution ? '#d97706' : '#475569'} stroke="#fff" strokeWidth={1.5} />
              <text x={cx} y={H - PAD_B + 16} textAnchor="middle" fontSize={11} fill={isSelected ? 'var(--ink-0)' : 'var(--ink-2)'} fontWeight={isSelected ? 700 : 400}>{y.year}</text>
              {activeDomains.has('overall') && (
                <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fill="var(--ink-1)" fontWeight={600}>{y.overallScore}</text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
