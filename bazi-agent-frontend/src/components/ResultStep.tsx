import type { NormalizedChartRich } from '../chartRich';
import type { TransitSnapshot } from '../types';
import { FiveElementsSection } from './result/FiveElementsSection';
import { FortuneSection } from './result/FortuneSection';
import { GodsSection } from './result/GodsSection';
import { PillarsSection } from './result/PillarsSection';
import { RelationsSection } from './result/RelationsSection';
import { TransitSection } from './result/TransitSection';

export function ResultStep(props: {
  t: Record<string, string>;
  chart: NormalizedChartRich | null;
  transit: TransitSnapshot | null;
  onEdit: () => void;
  onBack: () => void;
}) {
  const { t, chart, transit, onEdit, onBack } = props;

  if (!chart) {
    return (
      <section className="result-page">
        <header className="result-fallback-header">
          <button type="button" className="ghost-btn" onClick={onBack}>
            {t.backToHome}
          </button>
        </header>
        <section className="panel">
          <h3>{t.resultTitle}</h3>
          <p className="muted">{t.analysisFallback}</p>
        </section>
      </section>
    );
  }

  return (
    <section className="result-page">
      <header className="result-hero">
        <div className="hero-left">
          <div className="hero-badge">1</div>
          <div className="hero-copy">
            <h2>{t.resultTitle}</h2>
            <p className="hero-subline">Bazi Master · Structured Edition</p>
            <p>{chart.basic.lunar}</p>
            <p>{chart.basic.solar}</p>
          </div>
        </div>
        <div className="hero-actions">
          <button className="ghost-btn" type="button" onClick={onBack}>
            {t.backToHome}
          </button>
          <button className="ghost-btn" type="button" onClick={onEdit}>
            {t.edit}
          </button>
        </div>
      </header>

      <section className="result-meta-strip panel">
        {[
          ['性别', chart.basic.gender],
          ['生肖', chart.basic.zodiac],
          ['命宫', chart.basic.mingGong],
          ['身宫', chart.basic.shenGong],
          ['胎元', chart.basic.taiYuan],
          ['胎息', chart.basic.taiXi],
        ].map(([label, value]) => (
          <div key={label} className="meta-pill">
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <div className="result-top-grid">
        <PillarsSection title={t.panelPillars} pillars={chart.pillars} />
        <FiveElementsSection title={t.panelElements} data={chart.fiveElements} />
      </div>

      <TransitSection t={t} transit={transit} />

      <FortuneSection
        t={t}
        title={t.panelFortune}
        subtitle={t.panelFortuneSubtitle}
        startAge={chart.fortune.startAge}
        startDate={chart.fortune.startDate}
        fortuneList={chart.fortune.list}
        decades={chart.fortune.decades}
      />

      <div className="result-bottom-grid">
        <GodsSection title={t.panelGods} gods={chart.gods} />
        <RelationsSection title={t.panelRelations} highlights={chart.relations.highlights} />
      </div>

    </section>
  );
}
