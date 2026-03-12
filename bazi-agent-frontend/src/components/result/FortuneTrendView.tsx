function mapTrendScore(stage?: string): number {
  const value = String(stage ?? '');
  if (value.includes('帝') || value.includes('建')) return 90;
  if (value.includes('冠') || value.includes('长')) return 78;
  if (value.includes('衰') || value.includes('养')) return 62;
  if (value.includes('病') || value.includes('墓')) return 45;
  if (value.includes('绝') || value.includes('死')) return 30;
  if (value.includes('胎') || value.includes('沐')) return 54;
  return 50;
}

export function FortuneTrendView(props: {
  decadeFortunes: Array<Record<string, unknown>>;
}) {
  const { decadeFortunes } = props;
  const data = decadeFortunes.map((item, idx) => ({
    idx,
    label: String(item['干支'] ?? idx + 1),
    age: String(item['开始年龄'] ?? '-'),
    score: mapTrendScore(String(item['十二运'] ?? '')),
  }));

  if (data.length === 0) {
    return <div className="trend-empty">暂无趋势数据</div>;
  }

  const width = 760;
  const height = 230;
  const padX = 32;
  const padY = 26;
  const step = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padX + i * step;
    const y = height - padY - (d.score / 100) * (height - padY * 2);
    return { ...d, x, y };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <section className="trend-panel panel">
      <div className="trend-head">
        <h4>运势图表</h4>
        <span>基于十二运映射的趋势预览</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-svg" role="img" aria-label="fortune trend">
        <defs>
          <linearGradient id="trend-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9c6f2f" />
            <stop offset="100%" stopColor="#2f6dcf" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="url(#trend-line)" strokeWidth="3" />
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="4" fill="#1f2c44" />
            <text x={p.x} y={height - 6} textAnchor="middle" className="trend-tick">
              {p.label}
            </text>
            <text x={p.x} y={p.y - 10} textAnchor="middle" className="trend-value">
              {p.score}
            </text>
            <text x={p.x} y={height - 20} textAnchor="middle" className="trend-age">
              {p.age}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}

