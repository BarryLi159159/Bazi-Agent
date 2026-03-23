import type { TransitLayer, TransitSnapshot } from '../../types';

function joinNonEmpty(values: string[]): string {
  return values.map((item) => item.trim()).filter(Boolean).join(' / ');
}

function formatGeneratedAt(value: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function labelForLayer(t: Record<string, string>, key: TransitLayer['key']): string {
  if (key === 'year') return t.transitYear;
  if (key === 'month') return t.transitMonth;
  if (key === 'day') return t.transitDay;
  return t.transitHour;
}

export function TransitSection(props: {
  t: Record<string, string>;
  transit: TransitSnapshot | null;
}) {
  const { t, transit } = props;
  if (!transit || transit.layers.length === 0) {
    return null;
  }

  return (
    <section className="panel transit-panel">
      <div className="panel-title-row">
        <div>
          <h3>{t.panelTransit}</h3>
          <span className="panel-sub">{t.panelTransitSubtitle}</span>
        </div>
        <span className="transit-generated-at">
          {t.transitGeneratedAt}: {formatGeneratedAt(transit.generatedAt)}
        </span>
      </div>

      <div className="transit-grid">
        {transit.layers.map((layer) => (
          <article key={layer.key} className={`transit-card transit-card-${layer.key}`}>
            <div className="transit-card-head">
              <span className="transit-layer-tag">{labelForLayer(t, layer.key)}</span>
              <strong className="transit-ganzhi">{layer.ganZhi || '-'}</strong>
            </div>

            <div className="transit-char-pair">
              <div className="transit-char-cell">
                <small>{layer.stemElement || '-'}</small>
                <strong>{layer.stem || '-'}</strong>
              </div>
              <div className="transit-char-cell">
                <small>{layer.branchElement || '-'}</small>
                <strong>{layer.branch || '-'}</strong>
              </div>
            </div>

            <div className="transit-meta-grid">
              <div>
                <small>{t.fortuneStemTenGod}</small>
                <span>{layer.stemTenGod || '-'}</span>
              </div>
              <div>
                <small>{t.fortuneNaYin}</small>
                <span>{layer.naYin || '-'}</span>
              </div>
              <div>
                <small>{t.fortuneCycleState}</small>
                <span>{layer.xingYun || '-'}</span>
              </div>
              <div>
                <small>空亡</small>
                <span>{layer.kongWang || '-'}</span>
              </div>
            </div>

            <div className="transit-hidden-row">
              <small>{t.fortuneHiddenStems}</small>
              <span>{joinNonEmpty(layer.hiddenStems.map((item) => item.stem)) || '-'}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
