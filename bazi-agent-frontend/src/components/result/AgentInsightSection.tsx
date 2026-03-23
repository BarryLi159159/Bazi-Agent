import type { ChatResponse } from '../../types';

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function AgentInsightSection(props: {
  t: Record<string, string>;
  latestChat: ChatResponse | null;
}) {
  const { t, latestChat } = props;

  if (!latestChat) {
    return null;
  }

  const { assistantMessage, structured, meta } = latestChat;

  return (
    <section className="panel agent-output-panel">
      <div className="panel-title-row">
        <h3>{t.agentOutputTitle}</h3>
        <span className="panel-sub">{t.agentOutputSubtitle}</span>
      </div>

      <article className="agent-answer-block">
        <h4>{t.agentAnswerLabel}</h4>
        <p className="agent-answer-copy">{assistantMessage}</p>
      </article>

      <div className="agent-meta-row">
        <div className="meta-pill">
          <small>{t.agentIntentLabel}</small>
          <strong>{structured.intent}</strong>
        </div>
        <div className="meta-pill">
          <small>{t.agentConfidenceLabel}</small>
          <strong>{formatConfidence(structured.confidence)}</strong>
        </div>
        <div className="meta-pill">
          <small>{t.agentModelLabel}</small>
          <strong>{meta.modelProvider}</strong>
        </div>
      </div>

      <div className="agent-grid">
        <article className="agent-card">
          <h4>{t.agentQuestionLabel}</h4>
          <p>{structured.questionSummary}</p>
        </article>

        <article className="agent-card">
          <h4>{t.agentReasoningLabel}</h4>
          <ul className="agent-list">
            {structured.reasoningSummary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="agent-card">
          <h4>{t.agentThemesLabel}</h4>
          <div className="agent-tag-row">
            {structured.analysis.coreThemes.map((item) => (
              <span key={item} className="agent-tag">
                {item}
              </span>
            ))}
          </div>
        </article>

        <article className="agent-card">
          <h4>{t.agentAdviceLabel}</h4>
          <ul className="agent-list">
            {structured.analysis.advice.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      {structured.analysis.timeWindows.length > 0 ? (
        <article className="agent-time-panel">
          <h4>{t.agentTimeWindowsLabel}</h4>
          <div className="agent-time-grid">
            {structured.analysis.timeWindows.map((item) => (
              <div key={`${item.label}-${item.signal}`} className="agent-time-card">
                <div className="agent-time-head">
                  <strong>{item.label}</strong>
                  <span className={`agent-signal-pill ${item.signal}`}>{item.signal}</span>
                </div>
                <p>{item.note}</p>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {structured.analysis.risks.length > 0 ? (
        <article className="agent-risk-panel">
          <h4>{t.agentRisksLabel}</h4>
          <ul className="agent-list">
            {structured.analysis.risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
