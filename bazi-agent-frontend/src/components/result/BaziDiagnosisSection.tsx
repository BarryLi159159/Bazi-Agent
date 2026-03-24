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

export function BaziDiagnosisSection(props: {
  t: Record<string, string>;
  analysis: StructuredAnalysis | null;
  assistantMessage: string | null;
  chatMeta: ChatResponseMeta | null;
}) {
  const { t, analysis, assistantMessage, chatMeta } = props;
  const usedFallback = chatMeta?.usedFallback ?? false;
  const providerName = chatMeta?.modelProvider ?? null;

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
      ) : (
        <>
          {assistantMessage ? (
            <div className="diagnosis-lead-card">
              <small>{t.diagnosisLeadLabel ?? '主回答'}</small>
              <p className="diagnosis-lead">{assistantMessage}</p>
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
            <article className="diagnosis-summary-card">
              <small>{t.diagnosisConfidenceLabel ?? '置信度'}</small>
              <strong>{formatConfidence(analysis.confidence)}</strong>
            </article>
          </div>

          <div className="diagnosis-card-grid">
            <article className="diagnosis-card">
              <h4>{t.diagnosisStructureCardTitle ?? '命局判断'}</h4>
              <div className="diagnosis-kv-grid">
                <div className="diagnosis-kv">
                  <small>{t.diagnosisStructureTypeLabel ?? '格局类型'}</small>
                  <span>{structurePatternLabel(analysis.structureType.pattern)}</span>
                </div>
                <div className="diagnosis-kv">
                  <small>{t.diagnosisDayMasterLabel ?? '日主承载'}</small>
                  <span>{dayMasterStrengthLabel(analysis.capacity.dayMasterStrength)}</span>
                </div>
                <div className="diagnosis-kv">
                  <small>{t.diagnosisExtremeLabel ?? '是否极端'}</small>
                  <span>{analysis.structureType.isExtreme ? (t.diagnosisYes ?? '是') : (t.diagnosisNo ?? '否')}</span>
                </div>
                <div className="diagnosis-kv">
                  <small>{t.diagnosisStabilityLabel ?? '稳定性'}</small>
                  <span>{stabilityLabel(analysis.stability.level)}</span>
                </div>
              </div>
              <p>{analysis.capacity.loadBearing}</p>
              <p>{analysis.capacity.note}</p>
              <p>{analysis.structureType.extremeNote}</p>
              <p>{analysis.structureType.followAdjustment}</p>
            </article>

            <article className="diagnosis-card">
              <h4>{t.diagnosisFailureCardTitle ?? '病点与救应'}</h4>
              <div className="diagnosis-kv">
                <small>{t.diagnosisPrimaryFailureLabel ?? '主要病点'}</small>
                <span>{analysis.failure.primaryFailure}</span>
              </div>
              <div className="diagnosis-kv">
                <small>{t.diagnosisRescueLabel ?? '是否可救'}</small>
                <span>{analysis.rescue.rescuable ? (t.diagnosisRescuable ?? '可救') : (t.diagnosisNotRescuable ?? '难救')}</span>
              </div>
              <p>{analysis.rescue.rescueReason}</p>
              <div className="diagnosis-section-block">
                <small>{t.diagnosisImbalanceLabel ?? '五行失衡'}</small>
                {renderTagList(analysis.failure.fiveElementImbalance, t.diagnosisNone ?? '暂无')}
              </div>
              <div className="diagnosis-section-block">
                <small>{t.diagnosisClashesLabel ?? '冲合刑害'}</small>
                {renderBulletList(analysis.failure.clashes, t.diagnosisNone ?? '暂无')}
              </div>
              <div className="diagnosis-section-block">
                <small>{t.diagnosisBreaksLabel ?? '结构破点'}</small>
                {renderBulletList(analysis.failure.structuralBreaks, t.diagnosisNone ?? '暂无')}
              </div>
            </article>

            <article className="diagnosis-card diagnosis-card-wide">
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
              </div>
              <p>{analysis.usefulGods.rationale}</p>
              <div className="diagnosis-kv-grid">
                <div className="diagnosis-kv">
                  <small>{t.diagnosisUsefulGodCandidateLabel ?? '候选用神'}</small>
                  <span>{joinItems(analysis.rescue.candidateUsefulGods)}</span>
                </div>
                <div className="diagnosis-kv">
                  <small>{t.diagnosisUsefulGodEffectiveLabel ?? '是否得力'}</small>
                  <span>{analysis.usefulGodEffectiveness.effective ? (t.diagnosisEffective ?? '得力') : (t.diagnosisIneffective ?? '不得力')}</span>
                </div>
                <div className="diagnosis-kv">
                  <small>{t.diagnosisUsefulGodRootedLabel ?? '是否有根'}</small>
                  <span>{analysis.usefulGodEffectiveness.rooted ? (t.diagnosisYes ?? '是') : (t.diagnosisNo ?? '否')}</span>
                </div>
                <div className="diagnosis-kv">
                  <small>{t.diagnosisUsefulGodConstraintLabel ?? '是否受制'}</small>
                  <span>{analysis.usefulGodEffectiveness.constrained ? (t.diagnosisYes ?? '是') : (t.diagnosisNo ?? '否')}</span>
                </div>
              </div>
              <p>{analysis.usefulGodEffectiveness.reason}</p>
            </article>

            <article className="diagnosis-card">
              <h4>{t.diagnosisPreferenceCardTitle ?? '喜忌与风险'}</h4>
              <div className="diagnosis-section-block">
                <small>{t.diagnosisFavorableLabel ?? '喜神/有利因素'}</small>
                {renderTagList(analysis.preferences.favorable, t.diagnosisNone ?? '暂无')}
              </div>
              <div className="diagnosis-section-block">
                <small>{t.diagnosisUnfavorableLabel ?? '忌神/不利因素'}</small>
                {renderTagList(analysis.preferences.unfavorable, t.diagnosisNone ?? '暂无')}
              </div>
              <p>{analysis.preferences.rationale}</p>
              <div className="diagnosis-section-block">
                <small>{t.diagnosisWeakPointLabel ?? '薄弱点'}</small>
                {renderBulletList(analysis.stability.weakPoints, t.diagnosisNone ?? '暂无')}
              </div>
              <div className="diagnosis-section-block">
                <small>{t.diagnosisCollapseLabel ?? '败局触发条件'}</small>
                {renderBulletList(analysis.failureMode.collapseTriggers, t.diagnosisNone ?? '暂无')}
              </div>
              <p>{analysis.failureMode.collapseCondition}</p>
            </article>

            <article className="diagnosis-card">
              <h4>{t.diagnosisLuckCardTitle ?? '运势影响'}</h4>
              <div className="diagnosis-kv-grid">
                <div className="diagnosis-kv">
                  <small>{t.diagnosisLuckEffectLabel ?? '运势作用'}</small>
                  <span>{luckEffectLabel(analysis.luckFlow.effectType)}</span>
                </div>
                <div className="diagnosis-kv">
                  <small>{t.diagnosisChartBasisLabel ?? '排盘依据'}</small>
                  <span>{analysis.chartBasis.baziSource ?? (t.diagnosisUnknown ?? '未标注')}</span>
                </div>
              </div>
              <p>{analysis.luckFlow.summary}</p>
              <div className="diagnosis-section-block">
                <small>{t.diagnosisLuckEvidenceLabel ?? '运势证据'}</small>
                {renderBulletList(analysis.luckFlow.evidence, t.diagnosisNone ?? '暂无')}
              </div>
              <div className="diagnosis-section-block">
                <small>{t.diagnosisPositiveLoopLabel ?? '正向循环'}</small>
                {renderBulletList(analysis.stability.positiveLoops, t.diagnosisNone ?? '暂无')}
              </div>
            </article>

            <article className="diagnosis-card diagnosis-card-wide">
              <h4>{t.diagnosisReasoningCardTitle ?? '诊断摘要'}</h4>
              {renderBulletList(analysis.reasoningSummary, t.diagnosisNone ?? '暂无')}
            </article>
          </div>
        </>
      )}
    </section>
  );
}
