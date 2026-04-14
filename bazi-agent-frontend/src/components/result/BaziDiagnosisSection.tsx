import { useState } from 'react';
import type { ChatResponseMeta, StructuredAnalysis } from '../../types';

function joinItems(items: string[]): string {
  return items.length > 0 ? items.join(' / ') : '-';
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function structurePatternLabel(pattern: StructuredAnalysis['structureType']['pattern']): string {
  switch (pattern) {
    case 'ordinary':
      return '普通格';
    case 'follow':
      return '从格';
    case 'transform':
      return '化格';
    default:
      return '待定';
  }
}

function dayMasterStrengthLabel(strength: StructuredAnalysis['capacity']['dayMasterStrength']): string {
  switch (strength) {
    case 'weak':
      return '偏弱';
    case 'balanced':
      return '平衡';
    case 'strong':
      return '偏强';
    default:
      return strength;
  }
}

function stabilityLabel(level: StructuredAnalysis['stability']['level']): string {
  switch (level) {
    case 'stable':
      return '稳定';
    case 'semi_stable':
      return '半稳定';
    case 'fragile':
      return '脆弱';
    default:
      return level;
  }
}

function luckEffectLabel(effectType: StructuredAnalysis['luckFlow']['effectType']): string {
  switch (effectType) {
    case 'repair':
      return '修复结构';
    case 'amplify_failure':
      return '放大病点';
    case 'collapse_trigger':
      return '触发败局';
    case 'mixed':
      return '正负并行';
    default:
      return effectType;
  }
}

function renderTagList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return <span className="diagnosis-empty">{emptyLabel}</span>;
  }

  return (
    <div className="diagnosis-tag-row">
      {items.map((item) => (
        <span key={item} className="diagnosis-tag">
          {item}
        </span>
      ))}
    </div>
  );
}

function renderBulletList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return <p className="diagnosis-empty">{emptyLabel}</p>;
  }

  return (
    <ul className="diagnosis-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function fallbackReasonLabel(meta: ChatResponseMeta | null, t: Record<string, string>): string | null {
  const code = meta?.fallbackErrorCode;
  if (!code) {
    return meta?.fallbackErrorMessage ?? null;
  }

  switch (code) {
    case 'insufficient_quota':
      return t.diagnosisFallbackQuota ?? 'quota exceeded';
    case 'invalid_api_key':
    case 'auth_error':
      return t.diagnosisFallbackAuth ?? 'auth failed';
    case 'rate_limit':
      return t.diagnosisFallbackRateLimit ?? 'rate limit reached';
    default:
      return meta?.fallbackErrorMessage ?? code;
  }
}

export function BaziDiagnosisSection(props: {
  t: Record<string, string>;
  analysis: StructuredAnalysis | null;
  assistantMessage: string | null;
  chatMeta: ChatResponseMeta | null;
  exportJson: Record<string, unknown> | null;
}) {
  const { t, analysis, assistantMessage, chatMeta, exportJson } = props;
  const usedFallback = chatMeta?.usedFallback ?? false;
  const providerName = chatMeta?.modelProvider ?? null;
  const fallbackReason = fallbackReasonLabel(chatMeta, t);
  const evidenceTitles = analysis ? [...new Set((analysis.evidenceSources ?? []).map((item) => item.title).filter(Boolean))].slice(0, 3) : [];
  const [copied, setCopied] = useState(false);

  async function handleCopyJson() {
    const payload = exportJson ?? analysis;
    if (!payload) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="panel diagnosis-panel">
      <div className="panel-title-row">
        <div className="diagnosis-head-copy">
          <h3>{t.diagnosisSectionTitle ?? 'AI 八字诊断'}</h3>
          <span className="panel-sub">{t.diagnosisSectionSubtitle ?? '10-step pipeline'}</span>
        </div>
        {chatMeta ? (
          <div className={`diagnosis-source-badge ${usedFallback ? 'fallback' : 'openai'}`}>
            <strong>{usedFallback ? (t.diagnosisSourceFallback ?? 'Fallback') : (t.diagnosisSourceOpenAi ?? 'OpenAI')}</strong>
            <small>{providerName}</small>
          </div>
        ) : null}
      </div>

      {!analysis ? (
        <div className="diagnosis-placeholder">
          {assistantMessage ? <p className="diagnosis-lead">{assistantMessage}</p> : null}
          <p className="muted">{t.diagnosisFallback ?? '本次结果还没有可展示的结构化诊断。'}</p>
        </div>
      ) : usedFallback ? (
        <div className="diagnosis-fallback-json-wrap">
          <div className="diagnosis-fallback-note">
            <div className="diagnosis-fallback-copy">
              <p>{t.diagnosisFallbackJsonHint ?? '当前是 fallback 模式，所以这里直接展示结构化 JSON，方便你核对和复制。'}</p>
              {fallbackReason ? <div className="diagnosis-fallback-reason">{fallbackReason}</div> : null}
            </div>
            <button type="button" className="ghost-btn diagnosis-copy-btn" onClick={() => void handleCopyJson()}>
              {copied ? (t.diagnosisJsonCopied ?? '已复制') : (t.diagnosisCopyJson ?? '复制 JSON')}
            </button>
          </div>
          <pre className="diagnosis-json-block">{JSON.stringify(exportJson ?? analysis, null, 2)}</pre>
        </div>
      ) : (
        <>
          {assistantMessage ? (
            <div className="diagnosis-lead-card">
              <small>{t.diagnosisLeadLabel ?? '主回答'}</small>
              <p className="diagnosis-lead">{assistantMessage}</p>
              {evidenceTitles.length > 0 ? (
                <p className="diagnosis-evidence-inline">
                  <strong>{t.diagnosisEvidenceTitle ?? '参考依据'}:</strong> {evidenceTitles.join('、')}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="diagnosis-overview-grid">
            <article className="diagnosis-summary-card">
              <small>{t.diagnosisCoreProblemLabel ?? '核心问题'}</small>
              <strong>{analysis.finalSummary.coreProblem}</strong>
            </article>
            <article className="diagnosis-summary-card">
              <small>{t.diagnosisSolutionLabel ?? '解决方向'}</small>
              <strong>{analysis.finalSummary.solution}</strong>
            </article>
            <article className="diagnosis-summary-card">
              <small>{t.diagnosisTrajectoryLabel ?? '轨迹影响'}</small>
              <strong>{analysis.finalSummary.trajectoryImpact}</strong>
            </article>
          </div>

          <div className="diagnosis-card-grid">
            <article className="diagnosis-card">
              <h4>{t.diagnosisStructureCardTitle ?? '命局判断'}</h4>
              <div className="diagnosis-kv-grid">
                <div className="diagnosis-kv">
                  <small>{t.diagnosisStructureTypeLabel ?? '格局'}</small>
                  <span>{structurePatternLabel(analysis.structureType.pattern)}</span>
                </div>
                <div className="diagnosis-kv">
                  <small>{t.diagnosisDayMasterLabel ?? '日主'}</small>
                  <span>{dayMasterStrengthLabel(analysis.capacity.dayMasterStrength)}</span>
                </div>
                <div className="diagnosis-kv">
                  <small>{t.diagnosisStabilityLabel ?? '稳定性'}</small>
                  <span>{stabilityLabel(analysis.stability.level)}</span>
                </div>
                <div className="diagnosis-kv">
                  <small>{t.diagnosisRescueLabel ?? '可救性'}</small>
                  <span>{analysis.rescue.rescuable ? (t.diagnosisRescuable ?? '可救') : (t.diagnosisNotRescuable ?? '难救')}</span>
                </div>
              </div>
            </article>

            <article className="diagnosis-card">
              <h4>{t.diagnosisUsefulGodCardTitle ?? '用神方案'}</h4>
              <div className="diagnosis-double-column">
                <div className="diagnosis-section-block">
                  <small>{t.diagnosisUsefulGodPrimaryLabel ?? '主用神'}</small>
                  {renderTagList(analysis.usefulGods.primary, t.diagnosisNone ?? '暂无')}
                </div>
                <div className="diagnosis-section-block">
                  <small>{t.diagnosisUsefulGodSupportLabel ?? '辅用神'}</small>
                  {renderTagList(analysis.usefulGods.support, t.diagnosisNone ?? '暂无')}
                </div>
                <div className="diagnosis-section-block">
                  <small>{t.diagnosisFavorableLabel ?? '喜'}</small>
                  {renderTagList(analysis.preferences.favorable, t.diagnosisNone ?? '暂无')}
                </div>
                <div className="diagnosis-section-block">
                  <small>{t.diagnosisUnfavorableLabel ?? '忌'}</small>
                  {renderTagList(analysis.preferences.unfavorable, t.diagnosisNone ?? '暂无')}
                </div>
              </div>
              <p>{analysis.usefulGods.rationale}</p>
            </article>

            <article className="diagnosis-card">
              <h4>{t.diagnosisLuckCardTitle ?? '运势影响'}</h4>
              <div className="diagnosis-kv-grid">
                <div className="diagnosis-kv">
                  <small>{t.diagnosisLuckEffectLabel ?? '运势作用'}</small>
                  <span>{luckEffectLabel(analysis.luckFlow.effectType)}</span>
                </div>
              </div>
              <p>{analysis.luckFlow.summary}</p>
            </article>
          </div>
        </>
      )}
    </section>
  );
}
