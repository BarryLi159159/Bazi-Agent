import type { ChatMessage } from '../../types';

function roleLabel(role: ChatMessage['role'], t: Record<string, string>): string {
  if (role === 'user') {
    return t.diagnosisChatUser ?? '你';
  }
  if (role === 'assistant') {
    return t.diagnosisChatAssistant ?? 'AI';
  }
  return role;
}

export function ResultChatSection(props: {
  t: Record<string, string>;
  messages: ChatMessage[];
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t, messages, draft, sending, onDraftChange, onSubmit } = props;

  return (
    <section className="panel result-chat-panel">
      <div className="panel-title-row">
        <h3>{t.diagnosisChatTitle ?? '继续追问'}</h3>
        <span className="panel-sub">{t.diagnosisChatSubtitle ?? 'same chart context'}</span>
      </div>

      <p className="muted result-chat-intro">
        {t.diagnosisChatHint ?? '继续围绕同一张命盘追问，系统会沿用当前会话上下文继续分析。'}
      </p>

      <div className="result-chat-thread">
        {messages.length === 0 ? (
          <p className="muted">{t.diagnosisChatEmpty ?? '当前还没有对话内容。'}</p>
        ) : (
          messages.map((message, index) => (
            <article key={message.id ?? `${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
              <div className="chat-bubble-head">
                <strong>{roleLabel(message.role, t)}</strong>
              </div>
              <p>{message.content}</p>
            </article>
          ))
        )}
      </div>

      <div className="result-chat-composer">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={t.diagnosisChatPlaceholder ?? '例如：那我的事业更适合稳定上班还是自己做？'}
          rows={3}
        />
        <button type="button" className="primary-btn result-chat-submit" onClick={onSubmit} disabled={sending}>
          {sending ? (t.diagnosisChatSending ?? '分析中...') : (t.diagnosisChatSubmit ?? '继续分析')}
        </button>
      </div>
    </section>
  );
}
