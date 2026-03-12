export function GodsSection(props: {
  title: string;
  gods: {
    year: string[];
    month: string[];
    day: string[];
    hour: string[];
  };
}) {
  const { title, gods } = props;
  const rows: Array<{ label: string; items: string[] }> = [
    { label: '年柱', items: gods.year },
    { label: '月柱', items: gods.month },
    { label: '日柱', items: gods.day },
    { label: '时柱', items: gods.hour },
  ];

  return (
    <section className="panel gods-panel">
      <div className="panel-title-row">
        <h3>{title}</h3>
        <span className="panel-sub">Shen Sha</span>
      </div>

      <div className="gods-grid">
        {rows.map((row) => (
          <div key={row.label} className="gods-row">
            <span>{row.label}</span>
            <div>
              {row.items.length > 0 ? (
                row.items.map((item, index) => (
                  <span key={`${item}-${index}`} className="gods-chip">
                    {item}
                  </span>
                ))
              ) : (
                <em>-</em>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
