const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

const STEM_META: Record<string, { 五行: string; 阴阳: '阳' | '阴' }> = {
  甲: { 五行: '木', 阴阳: '阳' },
  乙: { 五行: '木', 阴阳: '阴' },
  丙: { 五行: '火', 阴阳: '阳' },
  丁: { 五行: '火', 阴阳: '阴' },
  戊: { 五行: '土', 阴阳: '阳' },
  己: { 五行: '土', 阴阳: '阴' },
  庚: { 五行: '金', 阴阳: '阳' },
  辛: { 五行: '金', 阴阳: '阴' },
  壬: { 五行: '水', 阴阳: '阳' },
  癸: { 五行: '水', 阴阳: '阴' },
};

const BRANCH_META: Record<string, { 五行: string; 阴阳: '阳' | '阴'; 生肖: string }> = {
  子: { 五行: '水', 阴阳: '阳', 生肖: '鼠' },
  丑: { 五行: '土', 阴阳: '阴', 生肖: '牛' },
  寅: { 五行: '木', 阴阳: '阳', 生肖: '虎' },
  卯: { 五行: '木', 阴阳: '阴', 生肖: '兔' },
  辰: { 五行: '土', 阴阳: '阳', 生肖: '龙' },
  巳: { 五行: '火', 阴阳: '阴', 生肖: '蛇' },
  午: { 五行: '火', 阴阳: '阳', 生肖: '马' },
  未: { 五行: '土', 阴阳: '阴', 生肖: '羊' },
  申: { 五行: '金', 阴阳: '阳', 生肖: '猴' },
  酉: { 五行: '金', 阴阳: '阴', 生肖: '鸡' },
  戌: { 五行: '土', 阴阳: '阳', 生肖: '狗' },
  亥: { 五行: '水', 阴阳: '阴', 生肖: '猪' },
};

function stripAnsi(input: string): string {
  return input.replace(/\u001B\[[0-9;]*m/g, '');
}

function toLineArray(raw: string): string[] {
  return stripAnsi(raw)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd());
}

function matchPillarList(raw: string): string[] {
  const pairs = raw.match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g);
  if (!pairs || pairs.length < 4) {
    return [];
  }
  return pairs.slice(0, 4);
}

function parseBasic(lines: string[]) {
  const firstLine = lines.find((line) => line.includes('公历:') && line.includes('农历:')) ?? '';
  const sexMatch = firstLine.match(/(男命|女命)/);
  const sex = sexMatch?.[1] === '女命' ? '女' : '男';

  const solarMatch = firstLine.match(/公历:\s*(.*?)\s+农历:/);
  const lunarMatch = firstLine.match(/农历:\s*(.*?)(?:\s+上运时间：|\s+命宫:|$)/);

  const palaceMatch = firstLine.match(/命宫:([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);
  const fetalMatch = firstLine.match(/胎元:([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);
  const bodyMatch = firstLine.match(/身宫:([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);

  const fourPillarLine = lines.find((line) => line.includes('四柱：')) ?? '';
  const pillarMatch = fourPillarLine.match(/四柱[:：]\s*([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥\s]+)/);
  const pillarPairs = matchPillarList(pillarMatch?.[1] ?? '');
  const eightChar = pillarPairs.join(' ');

  return {
    性别: sex,
    阳历: solarMatch?.[1]?.trim() ?? '',
    农历: lunarMatch?.[1]?.trim() ?? '',
    八字: eightChar,
    命宫: palaceMatch?.[1],
    胎元: fetalMatch?.[1],
    身宫: bodyMatch?.[1],
  };
}

function buildPillar(pair: string | undefined) {
  if (!pair || pair.length !== 2) {
    return undefined;
  }
  const stem = pair.slice(0, 1);
  const branch = pair.slice(1, 2);
  if (!STEMS.includes(stem) || !BRANCHES.includes(branch)) {
    return undefined;
  }

  return {
    天干: {
      天干: stem,
      五行: STEM_META[stem]?.五行,
      阴阳: STEM_META[stem]?.阴阳,
    },
    地支: {
      地支: branch,
      五行: BRANCH_META[branch]?.五行,
      阴阳: BRANCH_META[branch]?.阴阳,
    },
  };
}

function parseElementStats(lines: string[]) {
  const scoreLine = lines.find(
    (line) => line.includes('金') && line.includes('木') && line.includes('水') && line.includes('火') && line.includes('土') && line.includes('强弱:'),
  );

  if (!scoreLine) {
    return undefined;
  }

  const value = (name: '金' | '木' | '水' | '火' | '土') => {
    const match = scoreLine.match(new RegExp(`${name}\\s*:?\\s*(\\d+)`));
    return match ? Number(match[1]) : undefined;
  };

  const strengthMatch = scoreLine.match(/强弱:(\d+)/);
  const medianMatch = scoreLine.match(/中值(\d+)/);
  const rootMatch = scoreLine.match(/强根:\s*([^\s]+)/);

  return {
    金: value('金'),
    木: value('木'),
    水: value('水'),
    火: value('火'),
    土: value('土'),
    强弱: strengthMatch ? Number(strengthMatch[1]) : undefined,
    中值: medianMatch ? Number(medianMatch[1]) : undefined,
    强根: rootMatch?.[1],
  };
}

function parseFortunes(lines: string[]) {
  const headline = lines.find((line) => line.startsWith('大运：'));
  const list = headline ? matchPillarList(headline.replace('大运：', '')) : [];

  const decadeRows = lines
    .map((line) => line.trim())
    .filter((line) => /^\d+\s+[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]\s+\S+\s+\S+/.test(line))
    .map((line) => {
      const match = line.match(
        /^(\d+)\s+([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])\s+(\S+)\s+(\S+)\s*(.*)$/,
      );
      if (!match) {
        return null;
      }
      return {
        开始年龄: Number(match[1]),
        干支: match[2],
        十二运: match[3],
        纳音: match[4],
        详情: match[5] || '',
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 12);

  return {
    列表: list,
    详情: decadeRows,
  };
}

export function parseBaziMasterOutput(rawOutput: string) {
  const lines = toLineArray(rawOutput);
  const basic = parseBasic(lines);
  const pairs = matchPillarList(basic.八字);
  const dayMaster = pairs[2]?.slice(0, 1);
  const yearBranch = pairs[0]?.slice(1, 2);
  const zodiac = yearBranch ? BRANCH_META[yearBranch]?.生肖 : undefined;

  return {
    来源: 'bazi-master',
    性别: basic.性别,
    阳历: basic.阳历,
    农历: basic.农历,
    八字: basic.八字,
    生肖: zodiac,
    日主: dayMaster,
    年柱: buildPillar(pairs[0]),
    月柱: buildPillar(pairs[1]),
    日柱: buildPillar(pairs[2]),
    时柱: buildPillar(pairs[3]),
    胎元: basic.胎元,
    命宫: basic.命宫,
    身宫: basic.身宫,
    五行统计: parseElementStats(lines),
    大运: parseFortunes(lines),
    原始文本: stripAnsi(rawOutput).trim(),
    解析信息: {
      parser: 'bazi-master-text-v1',
    },
  };
}
