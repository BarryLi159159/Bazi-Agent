import { useCallback, useMemo, useState } from 'react';
import type { NormalizedChartRich, NormalizedFortuneDecade, NormalizedPillar } from '../../chartRich';
import type { ChatMessage } from '../../types';

// ---- Algorithm: 60 Jiazi + interactions (same logic as backend) ----

const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const STEM_ELEMENT: Record<string,string> = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const BRANCH_CLASH = ['子午','丑未','寅申','卯酉','辰戌','巳亥'];
const BRANCH_COMBINE = ['子丑','寅亥','卯戌','辰酉','巳申','午未'];
const BRANCH_HARM = ['子卯','寅巳','丑戌','戌未'];
const STEM_CLASH: Record<string,boolean> = {'甲庚':true,'庚甲':true,'乙辛':true,'辛乙':true,'丙壬':true,'壬丙':true,'丁癸':true,'癸丁':true};
const STEM_COMBINE: Record<string,boolean> = {'甲己':true,'己甲':true,'乙庚':true,'庚乙':true,'丙辛':true,'辛丙':true,'丁壬':true,'壬丁':true,'戊癸':true,'癸戊':true};

function yearGanZhi(year: number) {
  const si = ((year-4)%10+10)%10;
  const bi = ((year-4)%12+12)%12;
  return { stem: STEMS[si]??'甲', branch: BRANCHES[bi]??'子', gz: `${STEMS[si]}${BRANCHES[bi]}` };
}

function pairMatch(a: string, b: string, list: string[]) {
  return list.includes(`${a}${b}`) || list.includes(`${b}${a}`);
}

interface YearHit { year: number; gz: string; daYun: string|null; tags: string[] }

function computeKeyYears(chart: NormalizedChartRich, startYear: number, endYear: number): YearHit[] {
  const natalStems = chart.pillars.map(p => p.stem).filter(Boolean);
  const natalBranches = chart.pillars.map(p => p.branch).filter(Boolean);
  const decades = chart.fortune.decades;
  const results: YearHit[] = [];

  for (let y = startYear; y <= endYear; y++) {
    const { stem, branch, gz } = yearGanZhi(y);
    const tags: string[] = [];
    for (const ns of natalStems) {
      if (STEM_CLASH[`${stem}${ns}`]) tags.push(`天干冲(${stem}冲${ns})`);
      if (STEM_COMBINE[`${stem}${ns}`]) tags.push(`天干合(${stem}合${ns})`);
    }
    for (const nb of natalBranches) {
      if (pairMatch(branch, nb, BRANCH_CLASH)) tags.push(`地支冲(${branch}冲${nb})`);
      if (pairMatch(branch, nb, BRANCH_COMBINE)) tags.push(`地支合(${branch}合${nb})`);
      if (pairMatch(branch, nb, BRANCH_HARM)) tags.push(`地支刑(${branch}刑${nb})`);
    }
    const daYun = findDaYun(y, decades);
    if (isDaYunTransition(y, decades)) tags.push('大运交接');
    if (tags.length > 0) results.push({ year: y, gz, daYun, tags });
  }
  return results;
}

function findDaYun(year: number, decades: NormalizedFortuneDecade[]): string|null {
  for (const d of decades) {
    if (d.startYear !== null && d.endYear !== null && year >= d.startYear && year <= d.endYear) return d.ganZhi;
  }
  return null;
}

function isDaYunTransition(year: number, decades: NormalizedFortuneDecade[]): boolean {
  return decades.some(d => d.startYear === year);
}

// ---- CLI flow state ----

type FlowStep = 'verify' | 'topic' | 'year' | 'predict';

interface VerifyQuestion { year: number; gz: string; tags: string[]; answer?: 'good'|'bad'|'neutral' }

const TOPICS_ZH = ['事业','财运','感情','健康','综合'];
const TOPICS_EN = ['Career','Wealth','Love','Health','General'];

function roleLabel(role: ChatMessage['role'], t: Record<string, string>): string {
  if (role === 'user') return t.diagnosisChatUser ?? '你';
  if (role === 'assistant') return t.diagnosisChatAssistant ?? 'AI';
  return role;
}

// ---- Component ----

export function PredictionChatSection(props: {
  t: Record<string, string>;
  language: string;
  chart: NormalizedChartRich;
  messages: ChatMessage[];
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSendMessage: (text: string) => void;
  onSubmit: () => void;
}) {
  const { t, language, chart, messages, draft, sending, onDraftChange, onSendMessage, onSubmit } = props;

  const currentYear = new Date().getFullYear();
  const birthYear = chart.fortune.decades[0]?.startYear
    ? chart.fortune.decades[0].startYear - (chart.fortune.decades[0].startAge ?? 8)
    : currentYear - 30;

  const pastHits = useMemo(() => computeKeyYears(chart, Math.max(birthYear + 16, currentYear - 15), currentYear - 1), [chart, birthYear, currentYear]);
  const futureHits = useMemo(() => computeKeyYears(chart, currentYear, currentYear + 10), [chart, currentYear]);
  const futureYears = useMemo(() => {
    const base = [currentYear, currentYear + 1];
    const fromHits = futureHits.map(h => h.year).filter(y => y > currentYear + 1);
    const merged = [...new Set([...base, ...fromHits])].sort((a,b) => a-b);
    return merged.slice(0, 8);
  }, [currentYear, futureHits]);

  const verifyQuestions = useMemo<VerifyQuestion[]>(() => {
    const significant = pastHits
      .filter(h => h.tags.some(tag => tag.includes('冲') || tag.includes('刑') || tag.includes('大运')))
      .slice(-5);
    if (significant.length < 2) return pastHits.slice(-3).map(h => ({ year: h.year, gz: h.gz, tags: h.tags }));
    return significant.map(h => ({ year: h.year, gz: h.gz, tags: h.tags }));
  }, [pastHits]);

  const [step, setStep] = useState<FlowStep>('verify');
  const [verifyIdx, setVerifyIdx] = useState(0);
  const [answers, setAnswers] = useState<VerifyQuestion[]>([]);
  const [chosenTopic, setChosenTopic] = useState<string|null>(null);
  const [chosenYear, setChosenYear] = useState<number|null>(null);

  const topics = language === 'en' ? TOPICS_EN : TOPICS_ZH;

  const handleVerifyAnswer = useCallback((answer: 'good'|'bad'|'neutral') => {
    const q = verifyQuestions[verifyIdx];
    if (!q) return;
    const updated = [...answers, { ...q, answer }];
    setAnswers(updated);
    if (verifyIdx + 1 < verifyQuestions.length) {
      setVerifyIdx(verifyIdx + 1);
    } else {
      setStep('topic');
    }
  }, [verifyIdx, verifyQuestions, answers]);

  const handleSkipVerify = useCallback(() => setStep('topic'), []);

  const handleTopicPick = useCallback((topic: string) => {
    setChosenTopic(topic);
    setStep('year');
  }, []);

  const handleYearPick = useCallback((year: number) => {
    setChosenYear(year);
    setStep('predict');

    const yearHit = futureHits.find(h => h.year === year);
    const hitDesc = yearHit ? yearHit.tags.join('、') : '无明显冲合';
    const verifyText = answers.length > 0
      ? answers.map(a => `${a.year}年(${a.gz}) ${a.tags.join('/')}：${a.answer === 'good' ? '好' : a.answer === 'bad' ? '不好' : '一般'}`).join('；')
      : '用户跳过了验证';

    const prompt = language === 'zh'
      ? `我想了解 ${year} 年（${yearHit?.gz ?? yearGanZhi(year).gz}）的${chosenTopic}运势。\n\n流年与命盘关系：${hitDesc}\n所在大运：${yearHit?.daYun ?? findDaYun(year, chart.fortune.decades) ?? '未知'}\n\n过往验证：${verifyText}\n\n请结合我的命盘和上述信息，分析这一年的具体运势，并给出可执行建议。`
      : `I want to know about my ${chosenTopic} fortune in ${year} (${yearHit?.gz ?? yearGanZhi(year).gz}).\n\nTransit interactions: ${hitDesc}\nCurrent decade luck: ${yearHit?.daYun ?? findDaYun(year, chart.fortune.decades) ?? 'unknown'}\n\nPast verification: ${verifyText}\n\nPlease analyze this year's fortune based on my chart and give actionable advice.`;

    onSendMessage(prompt);
  }, [answers, chosenTopic, language, futureHits, chart, onSendMessage]);

  const currentQ = verifyQuestions[verifyIdx];
  const zhLabel = language === 'zh';

  return (
    <section className="panel prediction-chat-panel">
      <div className="panel-title-row">
        <h3>{t.predictionTitle ?? '人生预测'}</h3>
      </div>

      {/* Step: Verify */}
      {step === 'verify' && currentQ && (
        <div className="prediction-cli-step">
          <p className="prediction-cli-prompt">
            {zhLabel
              ? `${currentQ.year} 年（${currentQ.gz}），你的命盘有「${currentQ.tags.join('、')}」——那年整体感觉如何？`
              : `In ${currentQ.year} (${currentQ.gz}), your chart had "${currentQ.tags.join(', ')}" — how was that year overall?`}
          </p>
          <div className="prediction-cli-options">
            <button type="button" className="prediction-option-btn prediction-option-good" onClick={() => handleVerifyAnswer('good')}>
              {zhLabel ? '👍 还不错' : '👍 Good'}
            </button>
            <button type="button" className="prediction-option-btn prediction-option-neutral" onClick={() => handleVerifyAnswer('neutral')}>
              {zhLabel ? '😐 一般' : '😐 Okay'}
            </button>
            <button type="button" className="prediction-option-btn prediction-option-bad" onClick={() => handleVerifyAnswer('bad')}>
              {zhLabel ? '👎 不太好' : '👎 Not great'}
            </button>
          </div>
          <div className="prediction-cli-meta">
            <span className="muted">{verifyIdx + 1} / {verifyQuestions.length}</span>
            <button type="button" className="ghost-btn prediction-skip-btn" onClick={handleSkipVerify}>
              {zhLabel ? '跳过验证 →' : 'Skip →'}
            </button>
          </div>
        </div>
      )}

      {step === 'verify' && verifyQuestions.length === 0 && (
        <div className="prediction-cli-step">
          <p className="muted">{zhLabel ? '命盘数据不足以生成验证问题，直接选择话题。' : 'Not enough data for verification. Pick a topic.'}</p>
          <button type="button" className="ghost-btn" onClick={() => setStep('topic')}>{zhLabel ? '继续 →' : 'Continue →'}</button>
        </div>
      )}

      {/* Step: Topic */}
      {step === 'topic' && (
        <div className="prediction-cli-step">
          <p className="prediction-cli-prompt">{zhLabel ? '你想看哪个方向？' : 'What area would you like to explore?'}</p>
          <div className="prediction-cli-options">
            {topics.map(topic => (
              <button key={topic} type="button" className="prediction-option-btn" onClick={() => handleTopicPick(topic)}>
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Year */}
      {step === 'year' && (
        <div className="prediction-cli-step">
          <p className="prediction-cli-prompt">{zhLabel ? `看${chosenTopic}——选一个年份：` : `${chosenTopic} — pick a year:`}</p>
          <div className="prediction-cli-options prediction-cli-year-grid">
            {futureYears.map(year => {
              const hit = futureHits.find(h => h.year === year);
              return (
                <button key={year} type="button" className="prediction-year-option" onClick={() => handleYearPick(year)}>
                  <span className="prediction-year-option-year">{year}</span>
                  <span className="prediction-year-option-gz">{yearGanZhi(year).gz}</span>
                  {hit && hit.tags.length > 0 && (
                    <span className="prediction-year-option-tags">
                      {hit.tags.slice(0, 2).map(tag => {
                        const short = tag.replace(/\(.*\)/, '');
                        return <span key={tag} className={`prediction-mini-tag ${tag.includes('冲') || tag.includes('刑') ? 'tag-warn' : 'tag-ok'}`}>{short}</span>;
                      })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step: Predict — show chat */}
      {step === 'predict' && (
        <>
          <div className="result-chat-thread">
            {messages.filter(m => m.role !== 'system').map((message, index) => (
              <article key={message.id ?? `${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
                <div className="chat-bubble-head">
                  <strong>{roleLabel(message.role, t)}</strong>
                </div>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
          <div className="result-chat-composer">
            <textarea
              value={draft}
              onChange={e => onDraftChange(e.target.value)}
              placeholder={t.predictionChatPlaceholder ?? '继续追问...'}
              rows={2}
            />
            <button type="button" className="primary-btn result-chat-submit" onClick={onSubmit} disabled={sending}>
              {sending ? (t.diagnosisChatSending ?? '分析中...') : (t.predictionChatSend ?? '发送')}
            </button>
          </div>
          <button type="button" className="ghost-btn prediction-restart-btn" onClick={() => { setStep('verify'); setVerifyIdx(0); setAnswers([]); setChosenTopic(null); setChosenYear(null); }}>
            {zhLabel ? '重新开始' : 'Start over'}
          </button>
        </>
      )}
    </section>
  );
}
