export type RagTopic = 'career' | 'wealth' | 'marriage' | 'health' | 'luckCycle' | 'usefulGod' | 'general';

const TOPIC_PATTERNS: Array<{ topic: RagTopic; pattern: RegExp }> = [
  { topic: 'career', pattern: /事业|工作|职业|升职|求职|创业|官运|仕途/ },
  { topic: 'wealth', pattern: /财运|赚钱|收入|财富|投资|发财|破财|偏财|正财/ },
  { topic: 'marriage', pattern: /婚姻|感情|对象|恋爱|结婚|伴侣|妻子|丈夫|桃花|姻缘|离婚/ },
  { topic: 'health', pattern: /健康|疾病|身体|生病|寿命|伤灾/ },
  { topic: 'luckCycle', pattern: /大运|流年|行运|运势|运程|今年|明年|十年/ },
  { topic: 'usefulGod', pattern: /用神|喜神|忌神|格局|调候|从格|化格|相神/ },
];

/**
 * Heading substrings that are relevant per topic.
 * Chunks whose heading matches an allowlisted substring get a scoring bonus.
 */
const TOPIC_CHAPTER_ALLOWLIST: Record<RagTopic, string[]> = {
  career: ['正官', '偏官', '七杀', '食神', '食神取运', '建禄', '月劫'],
  wealth: ['论财', '财取运', '偏财', '正财', '食神', '伤官'],
  marriage: ['论妻子', '宫分用神配六亲', '桃花'],
  health: ['阴阳生死', '刑冲', '墓库'],
  luckCycle: ['论行运', '行运成格变格', '喜忌干支', '支中喜忌逢运透清'],
  usefulGod: [
    '论用神', '用神成败', '用神变化', '用神纯杂', '用神格局高低',
    '用神因成得败', '用神配气候', '论相神', '杂气如何取用',
    '四吉神能破格', '四凶神能成格', '生克先后分吉凶',
  ],
  general: [],
};

const DENY_HEADING_HINTS = ['序', '自序', '原序', '凡例', '前言'];

export function classifyTopic(userMessage: string): RagTopic {
  const text = userMessage.trim();
  for (const { topic, pattern } of TOPIC_PATTERNS) {
    if (pattern.test(text)) {
      return topic;
    }
  }
  return 'general';
}

export function getChapterAllowlist(topic: RagTopic): string[] {
  return TOPIC_CHAPTER_ALLOWLIST[topic];
}

export function chapterTopicBonus(heading: string, topic: RagTopic): number {
  if (topic === 'general') {
    return 0;
  }
  const allowlist = TOPIC_CHAPTER_ALLOWLIST[topic];
  for (const allowed of allowlist) {
    if (heading.includes(allowed)) {
      return 6;
    }
  }
  return 0;
}

export function chapterDenyPenalty(heading: string): number {
  for (const hint of DENY_HEADING_HINTS) {
    if (heading.includes(hint)) {
      return -10;
    }
  }
  return 0;
}
