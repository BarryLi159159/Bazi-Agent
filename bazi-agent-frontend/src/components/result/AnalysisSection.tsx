export function AnalysisSection(props: {
  title: string;
  summary: {
    bazi: string;
    dayMaster: string;
    startAge: number | null;
    relationCount: number;
    godsCount: number;
    topPillar: string;
  };
}) {
  const { title, summary } = props;

  return (
    <section className="panel analysis-panel">
      <div className="panel-title-row">
        <h3>{title}</h3>
        <span className="panel-sub">CHART SUMMARY</span>
      </div>

      <div className="analysis-cards">
        <article className="analysis-card">
          <h4>命盘速览</h4>
          <p>八字：{summary.bazi}</p>
          <p>日主：{summary.dayMaster}</p>
          <p>起运年龄：{summary.startAge ?? '-'}</p>
        </article>

        <article className="analysis-card">
          <h4>结构信号</h4>
          <p>神煞标签数：{summary.godsCount}</p>
          <p>关系条数：{summary.relationCount}</p>
          <p>最活跃柱位：{summary.topPillar}</p>
        </article>

        <article className="analysis-card">
          <h4>下一步</h4>
          <div className="analysis-actions">
            <button type="button">看30天行动建议</button>
            <button type="button">看事业主题细化</button>
            <button type="button">看感情主题细化</button>
          </div>
        </article>
      </div>
    </section>
  );
}
