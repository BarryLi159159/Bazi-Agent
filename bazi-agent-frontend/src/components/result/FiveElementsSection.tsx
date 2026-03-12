import type { NormalizedFiveElements } from '../../chartRich';

export function FiveElementsSection(props: {
  title: string;
  data: NormalizedFiveElements;
}) {
  const { title, data } = props;
  const items = [
    { key: '金', value: data.metal },
    { key: '木', value: data.wood },
    { key: '水', value: data.water },
    { key: '火', value: data.fire },
    { key: '土', value: data.earth },
  ];
  const maxValue = Math.max(...items.map((item) => item.value ?? 0), 1);

  return (
    <section className="panel elements-panel">
      <div className="panel-title-row">
        <h3>{title}</h3>
        <span className="panel-sub">{data.method === 'derived' ? 'Derived from pillars' : 'Provider statistics'}</span>
      </div>

      <div className="element-grid">
        {items.map((item) => (
          <div key={item.key} className="element-card">
            <small>{item.key}</small>
            <strong>{item.value ?? '-'}</strong>
          </div>
        ))}
      </div>

      <div className="element-bars">
        {items.map((item) => {
          const value = item.value ?? 0;
          const width = Math.round((value / maxValue) * 100);
          return (
            <div key={`${item.key}-bar`} className="element-bar-row">
              <span>{item.key}</span>
              <div className="element-bar-track">
                <i style={{ width: `${width}%` }} />
              </div>
              <strong>{item.value ?? '-'}</strong>
            </div>
          );
        })}
      </div>

      <div className="meta-row">
        <span>强弱: {data.strength ?? '-'}</span>
        <span>中值: {data.median ?? '-'}</span>
        <span>强根: {data.strongRoot || '-'}</span>
      </div>
    </section>
  );
}
