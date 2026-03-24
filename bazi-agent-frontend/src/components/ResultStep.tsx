import { useState } from 'react';
import type { NormalizedChartRich } from '../chartRich';
import type { ChatMessage, StructuredAnalysis, TransitSnapshot } from '../types';
import { BaziDiagnosisSection } from './result/BaziDiagnosisSection';
import { FiveElementsSection } from './result/FiveElementsSection';
import { FortuneSection } from './result/FortuneSection';
import { GodsSection } from './result/GodsSection';
import { PillarsSection } from './result/PillarsSection';
import { RelationsSection } from './result/RelationsSection';
import { ResultChatSection } from './result/ResultChatSection';
import { TransitSection } from './result/TransitSection';

export function ResultStep(props: {
  t: Record<string, string>;
  chart: NormalizedChartRich | null;
  transit: TransitSnapshot | null;
  structuredAnalysis: StructuredAnalysis | null;
  assistantMessage: string | null;
  hasApiKey: boolean;
  chatMessages: ChatMessage[];
  chatDraft: string;
  chatSending: boolean;
  onChatDraftChange: (value: string) => void;
  onChatSubmit: () => void;
  onOpenSettings: () => void;
  onEdit: () => void;
  onBack: () => void;
}) {
  const { t, chart, transit, structuredAnalysis, assistantMessage, hasApiKey, chatMessages, chatDraft, chatSending, onChatDraftChange, onChatSubmit, onOpenSettings, onEdit, onBack } = props;
  const [activeView, setActiveView] = useState<'chart' | 'ai'>('chart');

  if (!chart) {
    return (
      <section className="result-page">
        <header className="result-fallback-header">
          <button type="button" className="ghost-btn" onClick={onBack}>
            {t.backToHome}
          </button>
        </header>
        <section className="panel">
          <h3>{t.resultTitle}</h3>
          <p className="muted">{t.analysisFallback}</p>
        </section>
      </section>
    );
  }

  return (
    <section className="result-page">
      <header className="result-hero">
        <div className="hero-left">
          <div className="hero-badge">1</div>
          <div className="hero-copy">
            <h2>{t.resultTitle}</h2>
            <p className="hero-subline">Bazi Master · Structured Edition</p>
            <p>{chart.basic.lunar}</p>
            <p>{chart.basic.solar}</p>
          </div>
        </div>
        <div className="hero-actions">
          <button className="ghost-btn" type="button" onClick={onBack}>
            {t.backToHome}
          </button>
          <button className="ghost-btn" type="button" onClick={onEdit}>
            {t.edit}
          </button>
        </div>
      </header>

      <section className="result-meta-strip panel">
        {[
          ['性别', chart.basic.gender],
          ['生肖', chart.basic.zodiac],
          ['命宫', chart.basic.mingGong],
          ['身宫', chart.basic.shenGong],
          ['胎元', chart.basic.taiYuan],
          ['胎息', chart.basic.taiXi],
        ].map(([label, value]) => (
          <div key={label} className="meta-pill">
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="panel result-view-switcher">
        <div className="segmented">
          <button type="button" className={activeView === 'chart' ? 'active' : ''} onClick={() => setActiveView('chart')}>
            {t.resultChartView ?? '命盘视图'}
          </button>
          <button type="button" className={activeView === 'ai' ? 'active' : ''} onClick={() => setActiveView('ai')}>
            {t.resultAiView ?? 'AI 解读'}
          </button>
        </div>
        {!hasApiKey ? <p className="muted result-view-hint">{t.resultAiLockedHint ?? '未设置 API key 时，AI 解读会保持为空。请先去 Settings 添加 API。'}</p> : null}
      </section>

      {activeView === 'chart' ? (
        <>
          <div className="result-top-grid">
            <PillarsSection title={t.panelPillars} pillars={chart.pillars} />
            <FiveElementsSection title={t.panelElements} data={chart.fiveElements} />
          </div>

          <TransitSection t={t} transit={transit} />

          <FortuneSection
            t={t}
            title={t.panelFortune}
            subtitle={t.panelFortuneSubtitle}
            startAge={chart.fortune.startAge}
            startDate={chart.fortune.startDate}
            fortuneList={chart.fortune.list}
            decades={chart.fortune.decades}
          />

          <div className="result-bottom-grid">
            <GodsSection title={t.panelGods} gods={chart.gods} />
            <RelationsSection title={t.panelRelations} highlights={chart.relations.highlights} />
          </div>
        </>
      ) : hasApiKey ? (
        <>
          <BaziDiagnosisSection t={t} analysis={structuredAnalysis} assistantMessage={assistantMessage} />

          <ResultChatSection
            t={t}
            messages={chatMessages}
            draft={chatDraft}
            sending={chatSending}
            onDraftChange={onChatDraftChange}
            onSubmit={onChatSubmit}
          />
        </>
      ) : (
        <section className="panel result-ai-empty">
          <h3>{t.resultAiEmptyTitle ?? 'AI 解读未启用'}</h3>
          <p className="muted">{t.resultAiEmptyBody ?? '当前账号还没有配置专属 API key，所以这里先保持为空，不显示规则兜底内容。'}</p>
          <button type="button" className="primary-btn result-ai-empty-btn" onClick={onOpenSettings}>
            {t.resultAiEmptyAction ?? '去 Settings 添加 API'}
          </button>
        </section>
      )}

    </section>
  );
}
