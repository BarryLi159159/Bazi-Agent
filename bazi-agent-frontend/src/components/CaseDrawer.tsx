import { useMemo, useState } from 'react';

type CaseRecord = {
  id: string;
  name: string;
  gender: 0 | 1;
  bazi: string;
  basic: string;
  createdAt: string;
};

export function CaseDrawer(props: {
  open: boolean;
  t: Record<string, string>;
  cases: CaseRecord[];
  loading: boolean;
  formatDate: (value: string) => string;
  onSelect: (sessionId: string) => void;
  onClose: () => void;
}) {
  const { open, t, cases, loading, formatDate, onSelect, onClose } = props;
  const [keyword, setKeyword] = useState('');
  const filteredCases = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((item) =>
      [item.name, item.bazi, item.basic].some((text) => text.toLowerCase().includes(q)),
    );
  }, [cases, keyword]);
  if (!open) return null;
  return (
    <div className="case-drawer-mask" onClick={onClose}>
      <aside className="case-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="case-drawer-head">
          <h3>{t.caseRecords}</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <input
          className="history-search"
          placeholder={t.caseName}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        {loading ? <p className="muted">...</p> : null}
        {!loading && filteredCases.length === 0 ? <p className="muted">{t.noCases}</p> : null}
        <div className="case-drawer-list">
          {filteredCases.map((item) => (
            <button key={item.id} type="button" className="case-item" onClick={() => onSelect(item.id)}>
              <strong>
                {t.caseName}: {item.name}
              </strong>
              <small>
                {t.caseGender}: {item.gender === 1 ? t.male : t.female}
              </small>
              <small>
                {t.caseBazi}: {item.bazi}
              </small>
              <small>
                {t.caseBasic}: {item.basic}
              </small>
              <small>{formatDate(item.createdAt)}</small>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
