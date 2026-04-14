import { useCallback, useState } from 'react';
import type { StructuredAnalysis } from '../../types';

type Snapshot = NonNullable<StructuredAnalysis['personalitySnapshot']>;

const ELEMENT_CLASS: Record<string, string> = {
  '金': 'element-metal',
  '木': 'element-wood',
  '水': 'element-water',
  '火': 'element-fire',
  '土': 'element-earth',
  metal: 'element-metal',
  wood: 'element-wood',
  water: 'element-water',
  fire: 'element-fire',
  earth: 'element-earth',
};

function resolveElementClass(dayMaster: string): string {
  for (const [key, cls] of Object.entries(ELEMENT_CLASS)) {
    if (dayMaster.includes(key)) return cls;
  }
  return 'element-wood';
}

export function PersonalityCard(props: {
  t: Record<string, string>;
  snapshot: Snapshot;
  dayMaster: string;
}) {
  const { t, snapshot, dayMaster } = props;
  const elClass = resolveElementClass(dayMaster);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    const text = `${snapshot.headline}\n${snapshot.description}\n幸运色：${snapshot.luckyColor} | 幸运方位：${snapshot.luckyDirection} | 年度关键词：${snapshot.yearKeyword}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      void navigator.share({ title: snapshot.headline, text });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  }, [snapshot]);

  return (
    <section className={`panel personality-card ${elClass}`}>
      <div className="personality-card-header">
        <h3 className="personality-headline">{snapshot.headline}</h3>
        <button type="button" className="ghost-btn personality-share-btn" onClick={handleShare}>
          {copied ? (t.personalityShareCopied ?? '已复制') : (t.personalityShare ?? '分享')}
        </button>
      </div>
      <p className="personality-desc">{snapshot.description}</p>
      <div className="personality-meta">
        <span><strong>{t.personalityColor ?? '幸运色'}</strong> {snapshot.luckyColor}</span>
        <span><strong>{t.personalityDirection ?? '方位'}</strong> {snapshot.luckyDirection}</span>
        <span><strong>{t.personalityKeyword ?? '年度词'}</strong> {snapshot.yearKeyword}</span>
      </div>
    </section>
  );
}
