import type { NormalizedPillar } from '../../chartRich';

function elementClass(element: string): string {
  switch (element) {
    case '金':
      return 'element-metal';
    case '木':
      return 'element-wood';
    case '水':
      return 'element-water';
    case '火':
      return 'element-fire';
    case '土':
      return 'element-earth';
    default:
      return '';
  }
}

function renderHiddenStems(hiddenStems: Array<{ slot: string; stem: string; tenGod: string }>) {
  if (hiddenStems.length === 0) {
    return <span>-</span>;
  }
  return (
    <div className="hidden-stems-list">
      {hiddenStems.map((item, index) => (
        <span key={`${item.slot}-${item.stem}-${index}`} className="hidden-stem-line">
          <i className={`hidden-stem-glyph ${elementClass(item.stem)}`}>{item.stem}</i>
          <em>{item.tenGod && item.tenGod !== '-' ? item.tenGod : ''}</em>
        </span>
      ))}
    </div>
  );
}

export function PillarsSection(props: {
  title: string;
  pillars: NormalizedPillar[];
  t?: Record<string, string>;
}) {
  const { title, pillars, t } = props;
  const label = (key: string, fallback: string): string => t?.[key] ?? fallback;

  return (
    <section className="panel pillars-panel">
      <div className="panel-title-row">
        <h3>{title}</h3>
        <span className="panel-sub">Four Pillars</span>
      </div>

      <div className="pillars-grid">
        <div className="pillars-row head">
          <span>{label('pillarDate', '日期')}</span>
          {pillars.map((pillar) => (
            <span key={pillar.key}>{pillar.label}</span>
          ))}
        </div>

        <div className="pillars-row subtle">
          <span>{label('pillarTenGod', '十神')}</span>
          {pillars.map((pillar) => (
            <span key={`${pillar.key}-ten`}>
              {pillar.key === 'day' && (!pillar.stemTenGod || pillar.stemTenGod === '-') ? label('diagnosisDayMasterLabel', '日主') : pillar.stemTenGod}
            </span>
          ))}
        </div>

        <div className="pillars-row">
          <span>{label('pillarStem', '天干')}</span>
          {pillars.map((pillar) => (
            <strong key={`${pillar.key}-stem`} className={elementClass(pillar.stemElement)}>
              {pillar.stem}
            </strong>
          ))}
        </div>

        <div className="pillars-row">
          <span>{label('pillarBranch', '地支')}</span>
          {pillars.map((pillar) => (
            <strong key={`${pillar.key}-branch`} className={elementClass(pillar.branchElement)}>
              {pillar.branch}
            </strong>
          ))}
        </div>

        <div className="pillars-row subtle">
          <span>{label('pillarYinYang', '阴阳')}</span>
          {pillars.map((pillar) => (
            <span key={`${pillar.key}-yinyang`}>
              {pillar.stemYinYang}/{pillar.branchYinYang}
            </span>
          ))}
        </div>

        <div className="pillars-row subtle">
          <span>{label('pillarHiddenStems', '藏干')}</span>
          {pillars.map((pillar) => (
            <div key={`${pillar.key}-hidden`}>{renderHiddenStems(pillar.hiddenStems)}</div>
          ))}
        </div>

        <div className="pillars-row subtle">
          <span>{label('pillarKongWang', '旬空')}</span>
          {pillars.map((pillar) => (
            <span key={`${pillar.key}-xunkong`}>
              {pillar.xun} / {pillar.kongWang}
            </span>
          ))}
        </div>

        <div className="pillars-row subtle">
          <span>{label('pillarXingYunZiZuo', '星运/自坐')}</span>
          {pillars.map((pillar) => (
            <span key={`${pillar.key}-terrain`}>
              {pillar.xingYun} / {pillar.ziZuo}
            </span>
          ))}
        </div>

        <div className="pillars-row subtle last">
          <span>{label('pillarNaYin', '纳音')}</span>
          {pillars.map((pillar) => (
            <span key={`${pillar.key}-nayin`}>{pillar.naYin}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
