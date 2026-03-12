import { useEffect, useMemo, useState } from 'react';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

function applyPillarEdits(
  bazi: Record<string, unknown> | null,
  edits: Record<string, { gan: string; zhi: string }>,
): Record<string, unknown> | null {
  if (!bazi) {
    return null;
  }
  const next: Record<string, unknown> = { ...bazi };
  (['年柱', '月柱', '日柱', '时柱'] as const).forEach((key) => {
    const pillar = asRecord(next[key]);
    if (!pillar) {
      return;
    }
    const tian = asRecord(pillar['天干']) ?? {};
    const di = asRecord(pillar['地支']) ?? {};
    const edit = edits[key];
    if (!edit) {
      return;
    }
    next[key] = {
      ...pillar,
      天干: { ...tian, 天干: edit.gan || String(tian['天干'] ?? '-') },
      地支: { ...di, 地支: edit.zhi || String(di['地支'] ?? '-') },
    };
  });

  const rebuilt = (['年柱', '月柱', '日柱', '时柱'] as const)
    .map((key) => {
      const pillar = asRecord(next[key]);
      const tian = asRecord(pillar?.['天干']);
      const di = asRecord(pillar?.['地支']);
      return `${String(tian?.['天干'] ?? '')}${String(di?.['地支'] ?? '')}`.trim();
    })
    .filter(Boolean)
    .join(' ');
  if (rebuilt) {
    next['八字'] = rebuilt;
  }
  return next;
}

export function ConfirmStep(props: {
  t: Record<string, string>;
  bazi: Record<string, unknown> | null;
  onBack: () => void;
  onConfirm: (nextBazi: Record<string, unknown> | null) => void;
  loading: boolean;
}) {
  const { t, bazi, onBack, onConfirm, loading } = props;

  const initialEdits = useMemo(() => {
    const keys = ['年柱', '月柱', '日柱', '时柱'] as const;
    const seed: Record<string, { gan: string; zhi: string }> = {};
    keys.forEach((key) => {
      const pillar = asRecord(bazi?.[key]);
      const tian = asRecord(pillar?.['天干']);
      const di = asRecord(pillar?.['地支']);
      seed[key] = {
        gan: String(tian?.['天干'] ?? ''),
        zhi: String(di?.['地支'] ?? ''),
      };
    });
    return seed;
  }, [bazi]);
  const [edits, setEdits] = useState<Record<string, { gan: string; zhi: string }>>(initialEdits);
  useEffect(() => {
    setEdits(initialEdits);
  }, [initialEdits]);

  const pillars = (['年柱', '月柱', '日柱', '时柱'] as const).map((key) => ({ key, value: edits[key] }));

  const handleChange = (key: string, field: 'gan' | 'zhi', value: string) => {
    setEdits((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { gan: '', zhi: '' }), [field]: value.slice(0, 1) },
    }));
  };

  return (
    <section className="confirm-page panel">
      <div className="confirm-header">
        <h2>{t.confirmTitle}</h2>
        <p>{t.confirmSubtitle}</p>
      </div>

      <div className="confirm-basic">
        <div>
          <span>八字</span>
          <strong>{String(bazi?.['八字'] ?? '-')}</strong>
        </div>
        <div>
          <span>农历</span>
          <strong>{String(bazi?.['农历'] ?? '-')}</strong>
        </div>
        <div>
          <span>阳历</span>
          <strong>{String(bazi?.['阳历'] ?? '-')}</strong>
        </div>
      </div>

      <div className="confirm-pillars">
        {pillars.map((item) => {
          return (
            <div key={item.key} className="confirm-pillar-card">
              <small>{item.key}</small>
              <input
                value={item.value?.gan ?? ''}
                onChange={(e) => handleChange(item.key, 'gan', e.target.value)}
                className="confirm-pillar-input"
              />
              <input
                value={item.value?.zhi ?? ''}
                onChange={(e) => handleChange(item.key, 'zhi', e.target.value)}
                className="confirm-pillar-input"
              />
            </div>
          );
        })}
      </div>

      <div className="confirm-actions">
        <button type="button" className="ghost-btn" onClick={onBack}>
          {t.reenter}
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={() => onConfirm(applyPillarEdits(bazi, edits))}
          disabled={loading}
        >
          {loading ? '...' : t.confirmStart}
        </button>
      </div>
    </section>
  );
}
