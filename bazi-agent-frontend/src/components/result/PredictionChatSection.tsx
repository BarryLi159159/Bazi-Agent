import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NormalizedChartRich, NormalizedFortuneDecade } from '../../chartRich';
import type { ChatMessage } from '../../types';

// ---- 60 Jiazi + interactions algorithm ----

const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
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

type TopicKey = 'career' | 'wealth' | 'relationship' | 'health' | 'general';

interface Interaction {
  type: '合' | '冲' | '刑' | '克';
  scope: '天干' | '地支';
  pillar: '年柱' | '月柱' | '日柱' | '时柱';
  desc: string;
}

interface YearScore {
  year: number;
  gz: string;
  daYun: string | null;
  isDaYunTransition: boolean;
  interactions: Interaction[];
  score: number;
  tone: 'good' | 'mixed' | 'bad' | 'flat';
}

const PILLAR_ORDER: Array<'年柱'|'月柱'|'日柱'|'时柱'> = ['年柱','月柱','日柱','时柱'];

function computeInteractions(chart: NormalizedChartRich, year: number): Interaction[] {
  const { stem: ys, branch: yb } = yearGanZhi(year);
  const result: Interaction[] = [];
  chart.pillars.slice(0,4).forEach((p, i) => {
    const pillarName = PILLAR_ORDER[i] ?? '年柱';
    if (STEM_CLASH[`${ys}${p.stem}`]) result.push({ type:'冲', scope:'天干', pillar: pillarName, desc: `${ys}冲${p.stem}` });
    if (STEM_COMBINE[`${ys}${p.stem}`]) result.push({ type:'合', scope:'天干', pillar: pillarName, desc: `${ys}合${p.stem}` });
    if (pairMatch(yb, p.branch, BRANCH_CLASH)) result.push({ type:'冲', scope:'地支', pillar: pillarName, desc: `${yb}冲${p.branch}` });
    if (pairMatch(yb, p.branch, BRANCH_COMBINE)) result.push({ type:'合', scope:'地支', pillar: pillarName, desc: `${yb}合${p.branch}` });
    if (pairMatch(yb, p.branch, BRANCH_HARM)) result.push({ type:'刑', scope:'地支', pillar: pillarName, desc: `${yb}刑${p.branch}` });
  });
  return result;
}

function findDaYun(year: number, decades: NormalizedFortuneDecade[]): string|null {
  for (const d of decades) {
    if (d.startYear !== null && d.endYear !== null && year >= d.startYear && year <= d.endYear) return d.ganZhi;
  }
  return null;
}

// Per-topic weighting — which pillar matters most for each life area
const TOPIC_PILLAR_WEIGHT: Record<TopicKey, Record<'年柱'|'月柱'|'日柱'|'时柱', number>> = {
  career:       { 年柱: 0.8, 月柱: 1.2, 日柱: 1.0, 时柱: 0.6 },
  wealth:       { 年柱: 0.7, 月柱: 1.0, 日柱: 1.2, 时柱: 0.9 },
  relationship: { 年柱: 0.5, 月柱: 0.8, 日柱: 1.5, 时柱: 0.8 },
  health:       { 年柱: 0.6, 月柱: 0.7, 日柱: 1.5, 时柱: 0.7 },
  general:      { 年柱: 0.9, 月柱: 1.0, 日柱: 1.1, 时柱: 0.8 },
};

const TYPE_BASE_WEIGHT: Record<Interaction['type'], number> = {
  合: +9,
  冲: -14,
  刑: -9,
  克: -5,
};

function scoreYear(chart: NormalizedChartRich, year: number, topic: TopicKey): YearScore {
  const interactions = computeInteractions(chart, year);
  const decades = chart.fortune.decades;
  const isTransition = decades.some(d => d.startYear === year);
  const pillarW = TOPIC_PILLAR_WEIGHT[topic];

  let score = 50;
  for (const it of interactions) {
    const w = pillarW[it.pillar] ?? 1.0;
    score += TYPE_BASE_WEIGHT[it.type] * w;
  }
  if (isTransition) score -= 4;
  score = Math.max(18, Math.min(92, Math.round(score)));

  let tone: YearScore['tone'];
  if (score >= 70) tone = 'good';
  else if (score >= 55) tone = 'mixed';
  else if (score >= 40) tone = 'flat';
  else tone = 'bad';

  return {
    year,
    gz: yearGanZhi(year).gz,
    daYun: findDaYun(year, decades),
    isDaYunTransition: isTransition,
    interactions,
    score,
    tone,
  };
}

// ---- localStorage for verification ----

type Answer = 'good' | 'bad' | 'neutral';
const STORAGE_PREFIX = 'bazi:prediction:verify:';

function storageKey(bazi: string): string {
  return STORAGE_PREFIX + (bazi || 'unknown').replace(/\s+/g, '');
}

function loadSavedAnswers(bazi: string): Record<number, Answer> {
  try {
    const raw = localStorage.getItem(storageKey(bazi));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Answer>;
    const result: Record<number, Answer> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const y = Number(k);
      if (Number.isFinite(y) && (v === 'good' || v === 'bad' || v === 'neutral')) result[y] = v;
    }
    return result;
  } catch { return {}; }
}

function saveAnswers(bazi: string, answers: Record<number, Answer>) {
  try { localStorage.setItem(storageKey(bazi), JSON.stringify(answers)); } catch { /* ignore */ }
}

// ---- Topic config ----

const TOPICS_ZH: Array<{ key: TopicKey; label: string; hint: string }> = [
  { key: 'career',       label: '事业', hint: '工作、职位、发展' },
  { key: 'wealth',       label: '财运', hint: '收入、投资、机会' },
  { key: 'relationship', label: '感情', hint: '伴侣、桃花、关系' },
  { key: 'health',       label: '健康', hint: '身体、精神、作息' },
  { key: 'general',      label: '综合', hint: '整体人生走势' },
];

const TOPICS_EN: Array<{ key: TopicKey; label: string; hint: string }> = [
  { key: 'career',       label: 'Career',       hint: 'Work & growth' },
  { key: 'wealth',       label: 'Wealth',       hint: 'Income & opportunity' },
  { key: 'relationship', label: 'Love',         hint: 'Partner & relationships' },
  { key: 'health',       label: 'Health',       hint: 'Body & wellbeing' },
  { key: 'general',      label: 'General',      hint: 'Overall life trend' },
];

function topicLabelZh(key: TopicKey): string {
  return TOPICS_ZH.find(t => t.key === key)?.label ?? key;
}

// ---- Component ----

export function PredictionChatSection(props: {
  t: Record<string, string>;
  language: string;
  chart: NormalizedChartRich;
  messages: ChatMessage[];
  sending: boolean;
  onSendMessage: (text: string) => void;
}) {
  const { t, language, chart, messages, sending, onSendMessage } = props;
  const zh = language === 'zh';
  const topics = zh ? TOPICS_ZH : TOPICS_EN;
  const bazi = chart.basic.bazi;

  const [topic, setTopic] = useState<TopicKey | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [precisionOpen, setPrecisionOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});

  useEffect(() => {
    setAnswers(loadSavedAnswers(bazi));
  }, [bazi]);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y < currentYear + 10; y++) arr.push(y);
    return arr;
  }, [currentYear]);

  const scoredYears = useMemo<YearScore[]>(() => {
    if (!topic) return [];
    return years.map(y => scoreYear(chart, y, topic));
  }, [years, chart, topic]);

  // Past key years for verification (algorithm based)
  const pastVerifyYears = useMemo<YearScore[]>(() => {
    const birthYear = chart.fortune.decades[0]?.startYear
      ? chart.fortune.decades[0].startYear - (chart.fortune.decades[0].startAge ?? 8)
      : currentYear - 30;
    const start = Math.max(birthYear + 16, currentYear - 15);
    const arr: YearScore[] = [];
    for (let y = start; y < currentYear; y++) {
      const s = scoreYear(chart, y, topic ?? 'general');
      // pick only ones with meaningful interactions
      if (s.interactions.length > 0) arr.push(s);
    }
    return arr.slice(-5);
  }, [chart, topic, currentYear]);

  const answeredCount = pastVerifyYears.filter(q => answers[q.year]).length;

  const setAnswer = useCallback((year: number, a: Answer) => {
    setAnswers(prev => {
      const next = { ...prev, [year]: a };
      saveAnswers(bazi, next);
      return next;
    });
  }, [bazi]);

  const clearAnswer = useCallback((year: number) => {
    setAnswers(prev => {
      const { [year]: _discard, ...rest } = prev;
      saveAnswers(bazi, rest);
      return rest;
    });
  }, [bazi]);

  const handleBarClick = useCallback((year: number) => {
    if (!topic) return;
    setSelectedYear(year);

    const ys = scoredYears.find(s => s.year === year);
    if (!ys) return;

    const topicLabel = zh ? topicLabelZh(topic) : topics.find(tt => tt.key === topic)?.label ?? topic;
    const hitsDesc = ys.interactions.length > 0
      ? ys.interactions.map(i => `${i.pillar}${i.type}(${i.desc})`).join('、')
      : (zh ? '无明显冲合' : 'no strong interactions');
    const daYun = ys.daYun ?? (zh ? '未知' : 'unknown');

    const verifyEntries = pastVerifyYears
      .map(q => ({ q, a: answers[q.year] }))
      .filter(x => x.a);
    const verifyText = verifyEntries.length > 0
      ? verifyEntries.map(({ q, a }) => `${q.year}年(${q.gz}) ${q.interactions.map(i=>i.desc).join('/')}：${a === 'good' ? '好' : a === 'bad' ? '不好' : '一般'}`).join('；')
      : '';

    const prompt = zh
      ? `我想了解 ${year} 年（${ys.gz}）的${topicLabel}运势。\n\n流年与命盘关系：${hitsDesc}\n所在大运：${daYun}\n算法粗评分：${ys.score}/100${ys.isDaYunTransition ? '（今年是大运交接年）' : ''}\n${verifyText ? `过往验证：${verifyText}\n` : ''}\n请结合我的命盘和上述信息，分析这一年${topicLabel}方面的具体走势，指出关键月份、机会、风险，并给出可执行建议。`
      : `I want to know about my ${topicLabel} fortune in ${year} (${ys.gz}).\n\nTransit interactions: ${hitsDesc}\nDecade luck: ${daYun}\nAlgorithmic score: ${ys.score}/100${ys.isDaYunTransition ? ' (decade transition year)' : ''}\n${verifyText ? `Past verification: ${verifyText}\n` : ''}\nPlease analyze this year's ${topicLabel} trajectory, highlight key months, opportunities, risks, and give actionable advice.`;

    onSendMessage(prompt);
  }, [topic, scoredYears, pastVerifyYears, answers, zh, topics, onSendMessage]);

  // ---------- Render ----------

  // Step 1: pick topic
  if (!topic) {
    return (
      <section className="panel prediction-chat-panel">
        <div className="panel-title-row">
          <h3>{t.predictionTitle ?? '人生预测'}</h3>
        </div>
        <p className="prediction-cli-prompt">
          {zh ? '选一个话题，看未来 10 年的轨迹：' : 'Pick a topic to see your 10-year trajectory:'}
        </p>
        <div className="prediction-topic-grid">
          {topics.map(tt => (
            <button key={tt.key} type="button" className="prediction-topic-card" onClick={() => setTopic(tt.key)}>
              <strong>{tt.label}</strong>
              <span className="muted">{tt.hint}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const selected = selectedYear ? scoredYears.find(s => s.year === selectedYear) : null;
  const selectedTopicLabel = topics.find(tt => tt.key === topic)?.label ?? topic;
  const maxScore = Math.max(...scoredYears.map(s => s.score));
  const minScore = Math.min(...scoredYears.map(s => s.score));

  return (
    <section className="panel prediction-chat-panel">
      <div className="prediction-header-row">
        <div>
          <h3 className="prediction-header-title">{selectedTopicLabel} · {zh ? '10 年轨迹' : '10-Year Trajectory'}</h3>
          <p className="muted prediction-header-sub">{zh ? `${currentYear} – ${currentYear + 9}` : `${currentYear} – ${currentYear + 9}`}</p>
        </div>
        <button type="button" className="ghost-btn" onClick={() => { setTopic(null); setSelectedYear(null); }}>
          {zh ? '换话题' : 'Switch topic'}
        </button>
      </div>

      {/* Precision mode — collapsible */}
      {pastVerifyYears.length > 0 && (
        <div className={`precision-box ${precisionOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="precision-toggle"
            onClick={() => setPrecisionOpen(v => !v)}
          >
            <span className="precision-toggle-icon">{precisionOpen ? '▾' : '▸'}</span>
            <span className="precision-toggle-label">
              {zh ? '精准模式' : 'Precision mode'}
            </span>
            <span className="precision-toggle-status muted">
              {answeredCount > 0
                ? (zh ? `已填 ${answeredCount}/${pastVerifyYears.length}，分析会更贴合你` : `${answeredCount}/${pastVerifyYears.length} saved, analysis tailored`)
                : (zh ? `可选 · 回答过往${pastVerifyYears.length}年提升准确度` : `Optional · answer past ${pastVerifyYears.length} years for accuracy`)}
            </span>
          </button>
          {precisionOpen && (
            <div className="precision-content">
              <p className="muted precision-hint">
                {zh
                  ? '这些是算法找出的你过去有明显冲合的年份——你回忆一下当年整体感觉，AI 会更懂你。'
                  : 'These are past years with significant interactions in your chart. Recall how each year felt and the AI gets a calibrated sense of you.'}
              </p>
              <div className="prediction-verify-list">
                {pastVerifyYears.map(q => {
                  const current = answers[q.year];
                  return (
                    <div key={q.year} className="prediction-verify-row">
                      <div className="prediction-verify-info">
                        <div className="prediction-verify-year-line">
                          <strong>{q.year}</strong>
                          <span className="muted">{q.gz}</span>
                        </div>
                        <div className="prediction-verify-tags">
                          {q.interactions.slice(0, 3).map((i, idx) => (
                            <span key={idx} className={`prediction-mini-tag ${i.type === '冲' || i.type === '刑' ? 'tag-warn' : 'tag-ok'}`}>
                              {i.pillar.replace('柱','')}{i.type}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="prediction-verify-options">
                        <button type="button" className={`prediction-option-btn prediction-option-good ${current === 'good' ? 'selected' : ''}`} onClick={() => current === 'good' ? clearAnswer(q.year) : setAnswer(q.year, 'good')}>👍</button>
                        <button type="button" className={`prediction-option-btn prediction-option-neutral ${current === 'neutral' ? 'selected' : ''}`} onClick={() => current === 'neutral' ? clearAnswer(q.year) : setAnswer(q.year, 'neutral')}>😐</button>
                        <button type="button" className={`prediction-option-btn prediction-option-bad ${current === 'bad' ? 'selected' : ''}`} onClick={() => current === 'bad' ? clearAnswer(q.year) : setAnswer(q.year, 'bad')}>👎</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trajectory bar chart */}
      <div className="trajectory-chart">
        {scoredYears.map(s => {
          const height = Math.max(8, s.score - 10); // minimum visible height
          return (
            <button
              key={s.year}
              type="button"
              className={`trajectory-bar tone-${s.tone} ${selectedYear === s.year ? 'active' : ''} ${s.isDaYunTransition ? 'transition' : ''}`}
              onClick={() => handleBarClick(s.year)}
              title={`${s.year} ${s.gz} · ${s.score}`}
            >
              <span className="trajectory-bar-score">{s.score}</span>
              <span className="trajectory-bar-fill" style={{ height: `${height}%` }} />
              <span className="trajectory-bar-year">{s.year}</span>
              <span className="trajectory-bar-gz">{s.gz}</span>
            </button>
          );
        })}
      </div>

      <div className="trajectory-legend">
        <span><span className="dot tone-good" />{zh ? '顺势' : 'Good'}</span>
        <span><span className="dot tone-mixed" />{zh ? '混合' : 'Mixed'}</span>
        <span><span className="dot tone-flat" />{zh ? '平稳' : 'Flat'}</span>
        <span><span className="dot tone-bad" />{zh ? '挑战' : 'Challenge'}</span>
        <span className="muted">· {zh ? `区间 ${minScore}-${maxScore}` : `range ${minScore}-${maxScore}`}</span>
      </div>

      {/* AI analysis section — appears after clicking a bar */}
      {selected && (
        <div className="trajectory-detail">
          <div className="trajectory-detail-head">
            <strong>{selected.year} · {selected.gz}</strong>
            <span className="muted">
              {zh ? `${selectedTopicLabel}得分 ${selected.score}` : `${selectedTopicLabel} score ${selected.score}`}
              {selected.daYun ? ` · ${zh ? '大运' : 'Decade'} ${selected.daYun}` : ''}
            </span>
          </div>
          {selected.interactions.length > 0 && (
            <div className="trajectory-detail-tags">
              {selected.interactions.map((i, idx) => (
                <span key={idx} className={`prediction-mini-tag ${i.type === '冲' || i.type === '刑' ? 'tag-warn' : 'tag-ok'}`}>
                  {i.pillar.replace('柱','')}{i.type}·{i.desc}
                </span>
              ))}
            </div>
          )}

          {(() => {
            const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
            if (sending && !lastAssistant) {
              return (
                <div className="trajectory-ai-loading">
                  <div className="trajectory-ai-spinner" />
                  <span className="muted">{zh ? 'AI 分析中...' : 'Analyzing...'}</span>
                </div>
              );
            }
            if (!lastAssistant) return null;
            return (
              <div className="trajectory-ai-output">
                {lastAssistant.content.split('\n').filter(line => line.trim().length > 0).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </section>
  );
}
