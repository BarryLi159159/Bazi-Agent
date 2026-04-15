import { useCallback } from 'react';
import type { ChatMessage } from '../../types';

const TOPICS_ZH = [
  { key: 'career', label: '事业' },
  { key: 'wealth', label: '财运' },
  { key: 'relationship', label: '感情' },
  { key: 'health', label: '健康' },
  { key: 'general', label: '综合' },
];

const TOPICS_EN = [
  { key: 'career', label: 'Career' },
  { key: 'wealth', label: 'Wealth' },
  { key: 'relationship', label: 'Love' },
  { key: 'health', label: 'Health' },
  { key: 'general', label: 'General' },
];

function buildYearChips(): number[] {
  const now = new Date().getFullYear();
  return [now, now + 1, now + 2, now + 3, now + 5];
}

function roleLabel(role: ChatMessage['role'], t: Record<string, string>): string {
  if (role === 'user') return t.diagnosisChatUser ?? '你';
  if (role === 'assistant') return t.diagnosisChatAssistant ?? 'AI';
  return role;
}

export function PredictionChatSection(props: {
  t: Record<string, string>;
  language: string;
  messages: ChatMessage[];
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t, language, messages, draft, sending, onDraftChange, onSubmit } = props;

  const topics = language === 'en' ? TOPICS_EN : TOPICS_ZH;
  const yearChips = buildYearChips();
  const userMessages = messages.filter((m) => m.role === 'user');
  const isFirstTurn = userMessages.length <= 1;

  const sendMessage = useCallback((text: string) => {
    if (sending) return;
    onDraftChange(text);
    setTimeout(() => onSubmit(), 0);
  }, [sending, onDraftChange, onSubmit]);

  const handleTopicClick = useCallback((topicLabel: string) => {
    const prompt = language === 'zh'
      ? `请帮我预测一下我的${topicLabel}运势，先问我几个问题来验证。`
      : `Please predict my ${topicLabel.toLowerCase()} fortune. Ask me some verification questions first.`;
    sendMessage(prompt);
  }, [language, sendMessage]);

  const handleYearClick = useCallback((year: number) => {
    const prompt = language === 'zh'
      ? `请帮我看看 ${year} 年的运势，有什么需要注意的？`
      : `What should I expect in ${year}? Any key things to watch out for?`;
    sendMessage(prompt);
  }, [language, sendMessage]);

  return (
    <section className="panel prediction-chat-panel">
      <div className="panel-title-row">
        <h3>{t.predictionTitle ?? '人生预测'}</h3>
        <span className="panel-sub">{t.predictionChatSubtitle ?? '对话式预测'}</span>
      </div>

      <p className="muted prediction-chat-intro">
        {t.predictionChatHint ?? '选择话题或年份开始预测，AI 会先问你几个问题验证过往经历，再给出预测。'}
      </p>

      {isFirstTurn && (
        <>
          <div className="prediction-chip-section">
            <span className="prediction-chip-label">{t.predictionTopicLabel ?? '选择话题'}</span>
            <div className="prediction-chip-row">
              {topics.map((topic) => (
                <button key={topic.key} type="button" className="prediction-chip" onClick={() => handleTopicClick(topic.label)}>
                  {topic.label}
                </button>
              ))}
            </div>
          </div>

          <div className="prediction-chip-section">
            <span className="prediction-chip-label">{t.predictionYearLabel ?? '或选年份'}</span>
            <div className="prediction-chip-row">
              {yearChips.map((year) => (
                <button key={year} type="button" className="prediction-chip prediction-chip-year" onClick={() => handleYearClick(year)}>
                  {year}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="result-chat-thread">
        {messages.length === 0 ? (
          <p className="muted">{t.predictionChatEmpty ?? '选择上方话题或年份，开始对话式预测。'}</p>
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
          placeholder={t.predictionChatPlaceholder ?? '输入你想了解的年份、话题，或者回答 AI 的验证问题...'}
          rows={3}
        />
        <button type="button" className="primary-btn result-chat-submit" onClick={onSubmit} disabled={sending}>
          {sending ? (t.diagnosisChatSending ?? '分析中...') : (t.predictionChatSend ?? '发送')}
        </button>
      </div>
    </section>
  );
}
