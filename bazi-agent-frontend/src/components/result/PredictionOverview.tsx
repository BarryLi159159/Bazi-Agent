import type { LifePrediction } from '../../types';

const EVENT_TYPE_LABEL: Record<string, Record<string, string>> = {
  zh: { opportunity: '机遇', risk: '风险', turning_point: '转折', noble_help: '贵人' },
  en: { opportunity: 'Opportunity', risk: 'Risk', turning_point: 'Turning Point', noble_help: 'Noble Help' },
};

export function PredictionOverview(props: {
  t: Record<string, string>;
  prediction: LifePrediction;
  language: string;
}) {
  const { t, prediction, language } = props;
  const labels = EVENT_TYPE_LABEL[language] ?? EVENT_TYPE_LABEL['zh'];

  return (
    <section className="panel prediction-overview">
      <h3 className="prediction-overview-title">
        {t.predictionOverviewTitle ?? '总览'}
        <span className="prediction-range-badge">
          {prediction.yearRange.start}–{prediction.yearRange.end}
        </span>
      </h3>
      <p className="prediction-narrative">{prediction.overallNarrative}</p>
      <div className="prediction-highlights">
        {prediction.peakYears.length > 0 && (
          <div className="prediction-highlight-group prediction-highlight-peak">
            <span className="prediction-highlight-label">{t.predictionPeakYears ?? '高光年份'}</span>
            <div className="prediction-highlight-tags">
              {prediction.peakYears.map((y) => (
                <span key={y} className="prediction-tag prediction-tag-peak">{y}</span>
              ))}
            </div>
          </div>
        )}
        {prediction.cautionYears.length > 0 && (
          <div className="prediction-highlight-group prediction-highlight-caution">
            <span className="prediction-highlight-label">{t.predictionCautionYears ?? '留意年份'}</span>
            <div className="prediction-highlight-tags">
              {prediction.cautionYears.map((y) => (
                <span key={y} className="prediction-tag prediction-tag-caution">{y}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
