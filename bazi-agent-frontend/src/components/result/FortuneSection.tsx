import type { NormalizedFortuneDecade } from '../../chartRich';

export function FortuneSection(props: {
  t: Record<string, string>;
  title: string;
  subtitle: string;
  startAge: number | null;
  startDate: string;
  fortuneList: string[];
  decades: NormalizedFortuneDecade[];
}) {
  const { t, title, subtitle, startAge, startDate, fortuneList, decades } = props;
  const currentYear = new Date().getFullYear();
  const activeIndex = decades.findIndex((item) => {
    if (item.startYear === null || item.endYear === null) {
      return false;
    }
    return currentYear >= item.startYear && currentYear <= item.endYear;
  });
  const currentFortune = activeIndex >= 0 ? decades[activeIndex] : null;

  return (
    <section className="panel fortune-panel">
      <div className="panel-title-row">
        <h3>{title}</h3>
        <span className="panel-sub">{subtitle}</span>
      </div>

      <div className="fortune-summary-row">
        <div className="fortune-summary-card">
          <small>起运年龄</small>
          <strong>{startAge ?? '-'}</strong>
        </div>
        <div className="fortune-summary-card">
          <small>起运日期</small>
          <strong>{startDate || '-'}</strong>
        </div>
        <div className="fortune-summary-card">
          <small>{t.panelFortune}</small>
          <strong>{fortuneList.length || decades.length}</strong>
        </div>
      </div>

      {currentFortune ? (
        <article className="fortune-current-card">
          <div className="fortune-current-head">
            <span className="fortune-current-label">{t.currentFortune}</span>
            <strong>{currentFortune.ganZhi || '-'}</strong>
            <em>{t.currentTag}</em>
          </div>
          <div className="fortune-current-meta">
            <span>
              {t.fortuneAgeRange}: {currentFortune.startAge ?? '-'} - {currentFortune.endAge ?? '-'}
            </span>
            <span>
              {t.fortuneYearRange}: {currentFortune.startYear ?? '-'} - {currentFortune.endYear ?? '-'}
            </span>
            <span>
              {t.fortuneStemTenGod}: {currentFortune.stemTenGod || '-'}
            </span>
          </div>
        </article>
      ) : null}

      {fortuneList.length > 0 ? (
        <div className="fortune-chip-row">
          {fortuneList.map((item, idx) => (
            <span key={`${item}-${idx}`} className="fortune-chip">
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <div className="fortune-decade-grid">
        {decades.map((item, index) => (
          <article key={`${item.ganZhi}-${index}`} className={`fortune-decade-card${index === activeIndex ? ' active' : ''}`}>
            <div className="fortune-card-head">
              <span className="fortune-card-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="fortune-card-title">
                <strong>{item.ganZhi || '-'}</strong>
                <span>
                  {item.startYear ?? '-'} - {item.endYear ?? '-'}
                </span>
              </div>
              {index === activeIndex ? <em className="fortune-card-active">{t.currentTag}</em> : null}
            </div>

            <div className="fortune-card-meta-grid">
              <div>
                <small>{t.fortuneAgeRange}</small>
                <span>
                  {item.startAge ?? '-'} - {item.endAge ?? '-'}
                </span>
              </div>
              <div>
                <small>{t.fortuneStemTenGod}</small>
                <span>{item.stemTenGod || '-'}</span>
              </div>
              <div>
                <small>{t.fortuneBranchTenGods}</small>
                <span>{item.branchTenGods.join(' / ') || '-'}</span>
              </div>
              <div>
                <small>{t.fortuneHiddenStems}</small>
                <span>{item.hiddenStems.join(' / ') || '-'}</span>
              </div>
              <div>
                <small>{t.fortuneNaYin}</small>
                <span>{item.naYin || '-'}</span>
              </div>
              <div>
                <small>{t.fortuneCycleState}</small>
                <span>{item.cycleState || '-'}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
