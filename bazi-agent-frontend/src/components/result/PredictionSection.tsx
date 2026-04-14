import { useCallback, useEffect, useState } from 'react';
import { fetchLifePrediction } from '../../api';
import type { LifePrediction } from '../../types';
import { PredictionOverview } from './PredictionOverview';
import { PredictionTimeline } from './PredictionTimeline';
import { YearDetailCard } from './YearDetailCard';

export function PredictionSection(props: {
  t: Record<string, string>;
  language: string;
  accessToken: string | null;
  hasBazi: boolean;
  hasApiKey: boolean;
  onOpenSettings: () => void;
}) {
  const { t, language, accessToken, hasBazi, hasApiKey, onOpenSettings } = props;
  const [prediction, setPrediction] = useState<LifePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const loadPrediction = useCallback(async (forceRefresh = false) => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLifePrediction(accessToken, { forceRefresh });
      setPrediction(result.prediction);
      setSelectedYear(result.prediction.years[0]?.year ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prediction');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && hasBazi && hasApiKey && !prediction && !loading) {
      void loadPrediction();
    }
  }, [accessToken, hasBazi, hasApiKey, prediction, loading, loadPrediction]);

  if (!hasBazi) {
    return (
      <section className="panel prediction-empty">
        <h3>{t.predictionTitle ?? '人生预测'}</h3>
        <p className="muted">{t.predictionNoBazi ?? '请先排盘后再使用人生预测功能。'}</p>
      </section>
    );
  }

  if (!hasApiKey) {
    return (
      <section className="panel prediction-empty">
        <h3>{t.predictionTitle ?? '人生预测'}</h3>
        <p className="muted">{t.predictionNoKey ?? '需要设置 API key 才能生成人生预测。'}</p>
        <button type="button" className="primary-btn" onClick={onOpenSettings}>
          {t.resultAiEmptyAction ?? '去 Settings 添加 API'}
        </button>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="panel prediction-loading">
        <h3>{t.predictionTitle ?? '人生预测'}</h3>
        <div className="prediction-loading-indicator">
          <div className="prediction-spinner" />
          <p className="muted">{t.predictionLoading ?? '正在生成预测，请稍候...'}</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel prediction-empty">
        <h3>{t.predictionTitle ?? '人生预测'}</h3>
        <p className="prediction-error">{error}</p>
        <button type="button" className="ghost-btn" onClick={() => void loadPrediction()}>
          {t.predictionRetry ?? '重试'}
        </button>
      </section>
    );
  }

  if (!prediction) return null;

  const selectedYearData = selectedYear ? prediction.years.find((y) => y.year === selectedYear) : null;

  return (
    <div className="prediction-section">
      <div className="prediction-section-header">
        <h3 className="prediction-section-title">{t.predictionTitle ?? '人生预测'}</h3>
        <button type="button" className="ghost-btn prediction-refresh-btn" onClick={() => void loadPrediction(true)}>
          {t.predictionRefresh ?? '重新生成'}
        </button>
      </div>

      <PredictionOverview t={t} prediction={prediction} language={language} />
      <PredictionTimeline t={t} prediction={prediction} language={language} selectedYear={selectedYear} onSelectYear={setSelectedYear} />

      {selectedYearData && (
        <YearDetailCard
          t={t}
          yearData={selectedYearData}
          language={language}
          isPeak={prediction.peakYears.includes(selectedYearData.year)}
          isCaution={prediction.cautionYears.includes(selectedYearData.year)}
        />
      )}
    </div>
  );
}
