import type { StructuredAnalysis } from '../../types';

type Fortune = NonNullable<StructuredAnalysis['annualFortune']>;

const CIRCUMFERENCE = 2 * Math.PI * 38;

export function AnnualFortuneCard(props: {
  t: Record<string, string>;
  fortune: Fortune;
}) {
  const { t, fortune } = props;
  const offset = CIRCUMFERENCE - (fortune.score / 100) * CIRCUMFERENCE;

  return (
    <section className="panel annual-fortune-card">
      <div className="fortune-ring-wrapper">
        <svg viewBox="0 0 90 90">
          <circle className="fortune-ring-bg" cx="45" cy="45" r="38" />
          <circle
            className="fortune-ring-fill"
            cx="45"
            cy="45"
            r="38"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="fortune-score">
          <span className="fortune-score-number">{fortune.score}</span>
          <span className="fortune-score-label">{t.fortuneScoreLabel ?? '运势指数'}</span>
        </div>
      </div>
      <div className="fortune-text">
        <h3>{fortune.year} {t.annualFortuneTitle ?? '年度运势'}</h3>
        <p className="fortune-summary">{fortune.summary}</p>
      </div>
    </section>
  );
}
