export function RelationsSection(props: {
  title: string;
  highlights: string[];
  t?: Record<string, string>;
}) {
  const { title, highlights, t } = props;

  return (
    <section className="panel relations-panel">
      <div className="panel-title-row">
        <h3>{title}</h3>
        <span className="panel-sub">{t?.relationSubtitle ?? '刑冲合会'}</span>
      </div>

      {highlights.length > 0 ? (
        <div className="relations-highlight-list">
          {highlights.map((item, index) => (
            <span key={`${item}-${index}`} className="relation-chip">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">{t?.relationEmpty ?? '暂无高亮关系'}</p>
      )}
    </section>
  );
}
