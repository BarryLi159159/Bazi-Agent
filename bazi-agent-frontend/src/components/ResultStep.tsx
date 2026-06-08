import { useState } from 'react';
import type { NormalizedChartRich } from '../chartRich';
import type { ChatMessage, ChatResponseMeta, StructuredAnalysis, TransitSnapshot } from '../types';
import { AnnualFortuneCard } from './result/AnnualFortuneCard';
import { BaziDiagnosisSection } from './result/BaziDiagnosisSection';
import { FiveElementsSection } from './result/FiveElementsSection';
import { FortuneSection } from './result/FortuneSection';
import { GodsSection } from './result/GodsSection';
import { PersonalityCard } from './result/PersonalityCard';
import { PillarsSection } from './result/PillarsSection';
import { PredictionChatSection } from './result/PredictionChatSection';
import { RelationsSection } from './result/RelationsSection';
import { TransitSection } from './result/TransitSection';

export function ResultStep(props: {
  t: Record<string, string>;
  chart: NormalizedChartRich | null;
  transit: TransitSnapshot | null;
  structuredAnalysis: StructuredAnalysis | null;
  assistantMessage: string | null;
  chatMeta: ChatResponseMeta | null;
  exportJson: Record<string, unknown> | null;
  hasApiKey: boolean;
  chatMessages: ChatMessage[];
  chatDraft: string;
  chatSending: boolean;
  language: string;
  accessToken: string | null;
  onChatDraftChange: (value: string) => void;
  onChatSubmit: () => void;
  onOpenSettings: () => void;
  onEdit: () => void;
  onBack: () => void;
}) {
  const { t, chart, transit, structuredAnalysis, assistantMessage, chatMeta, exportJson, hasApiKey, chatMessages, chatDraft, chatSending, language, onChatDraftChange, onChatSubmit, onOpenSettings, onEdit, onBack } = props;
  const [activeView, setActiveView] = useState<'ai' | 'prediction' | 'chart'>('ai');

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
          [t.labelGender ?? 'Gender', chart.basic.gender],
          [t.labelZodiac ?? 'Zodiac', chart.basic.zodiac],
          [t.labelMingGong ?? 'Life Palace', chart.basic.mingGong],
          [t.labelShenGong ?? 'Body Palace', chart.basic.shenGong],
          [t.labelTaiYuan ?? 'Fetal Origin', chart.basic.taiYuan],
          [t.labelTaiXi ?? 'Fetal Breath', chart.basic.taiXi],
        ].map(([label, value]) => (
          <div key={label} className="meta-pill">
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      {/* 首屏 AI 卡片：始终可见，不放在 Tab 内 */}
      {hasApiKey && (structuredAnalysis?.personalitySnapshot || structuredAnalysis?.annualFortune) ? (
        <div className="insight-cards-grid">
          {structuredAnalysis.personalitySnapshot ? (
            <PersonalityCard t={t} snapshot={structuredAnalysis.personalitySnapshot} dayMaster={chart.basic.dayMaster} />
          ) : null}
          {structuredAnalysis.annualFortune ? (
            <AnnualFortuneCard t={t} fortune={structuredAnalysis.annualFortune} />
          ) : null}
        </div>
      ) : null}

      <section className="panel result-view-switcher">
        <div className="segmented">
          <button type="button" className={activeView === 'ai' ? 'active' : ''} onClick={() => setActiveView('ai')}>
            {t.resultAiView ?? 'AI 解读'}
          </button>
          <button type="button" className={activeView === 'prediction' ? 'active' : ''} onClick={() => setActiveView('prediction')}>
            {t.resultPredictionView ?? '人生预测'}
          </button>
          <button type="button" className={activeView === 'chart' ? 'active' : ''} onClick={() => setActiveView('chart')}>
            {t.resultChartView ?? '命盘'}
          </button>
        </div>
        {!hasApiKey ? <p className="muted result-view-hint">{t.resultAiLockedHint ?? '未设置 API key 时，AI 解读会保持为空。请先去 Settings 添加 API。'}</p> : null}
      </section>

      {activeView === 'ai' ? (
        hasApiKey ? (
          <BaziDiagnosisSection t={t} analysis={structuredAnalysis} assistantMessage={assistantMessage} chatMeta={chatMeta} exportJson={exportJson} />
        ) : (
          <section className="panel result-ai-empty">
            <h3>{t.resultAiEmptyTitle ?? 'AI 解读未启用'}</h3>
            <p className="muted">{t.resultAiEmptyBody ?? '当前账号还没有配置专属 API key，所以这里先保持为空，不显示规则兜底内容。'}</p>
            <button type="button" className="primary-btn result-ai-empty-btn" onClick={onOpenSettings}>
              {t.resultAiEmptyAction ?? '去 Settings 添加 API'}
            </button>
          </section>
        )
      ) : activeView === 'prediction' ? (
        hasApiKey ? (
          <PredictionChatSection
            t={t}
            language={language}
            chart={chart}
            messages={chatMessages}
            draft={chatDraft}
            sending={chatSending}
            onDraftChange={onChatDraftChange}
            onSendMessage={(text: string) => { onChatDraftChange(text); setTimeout(() => onChatSubmit(), 0); }}
            onSubmit={onChatSubmit}
          />
        ) : (
          <section className="panel result-ai-empty">
            <h3>{t.predictionTitle ?? '人生预测'}</h3>
            <p className="muted">{t.predictionNoKey ?? '需要设置 API key 才能使用人生预测。'}</p>
            <button type="button" className="primary-btn result-ai-empty-btn" onClick={onOpenSettings}>
              {t.resultAiEmptyAction ?? '去 Settings 添加 API'}
            </button>
          </section>
        )
      ) : (
        <>
          <div className="result-top-grid">
            <PillarsSection title={t.panelPillars} pillars={chart.pillars} t={t} />
            <FiveElementsSection title={t.panelElements} data={chart.fiveElements} t={t} />
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
            <RelationsSection title={t.panelRelations} highlights={chart.relations.highlights} t={t} />
          </div>
        </>
      )}
    </section>
  );
}
