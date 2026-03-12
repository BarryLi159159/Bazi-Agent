import type { NormalizedFortuneDecade } from '../../chartRich';

export function FortuneSection(props: {
  title: string;
  subtitle: string;
  startAge: number | null;
  startDate: string;
  fortuneList: string[];
  decades: NormalizedFortuneDecade[];
}) {
  const { title, subtitle, startAge, startDate, fortuneList, decades } = props;

  return (
    <section className="panel fortune-panel">
      <div className="panel-title-row">
        <h3>{title}</h3>
        <span className="panel-sub">{subtitle}</span>
      </div>

      <div className="fortune-topline">
        <span>起运年龄：{startAge ?? '-'}</span>
        <span>起运日期：{startDate || '-'}</span>
      </div>

      {fortuneList.length > 0 ? (
        <div className="fortune-chip-row">
          {fortuneList.map((item, idx) => (
            <span key={`${item}-${idx}`} className="fortune-chip">
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <div className="fortune-table-wrap">
        <table className="fortune-table">
          <thead>
            <tr>
              <th>干支</th>
              <th>年龄段</th>
              <th>年份段</th>
              <th>天干十神</th>
              <th>地支十神</th>
              <th>地支藏干</th>
            </tr>
          </thead>
          <tbody>
            {decades.map((item, index) => (
              <tr key={`${item.ganZhi}-${index}`}>
                <td>
                  <strong>{item.ganZhi}</strong>
                </td>
                <td>
                  {item.startAge ?? '-'} - {item.endAge ?? '-'}
                </td>
                <td>
                  {item.startYear ?? '-'} - {item.endYear ?? '-'}
                </td>
                <td>{item.stemTenGod}</td>
                <td>{item.branchTenGods.join(' / ') || '-'}</td>
                <td>{item.hiddenStems.join(' / ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
