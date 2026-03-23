/** 将「甲子 乙丑 …」或连续「甲子乙丑丙寅丁卯」式八字拆为四柱天干、地支 */
export function parseBaziPillars(bazi: string): { stems: string[]; branches: string[] } | null {
  if (!bazi.trim()) {
    return null;
  }

  let parts = bazi
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/\s/g, ''))
    .filter(Boolean);

  if (parts.length === 1 && parts[0].length === 8) {
    const s = parts[0];
    parts = [s.slice(0, 2), s.slice(2, 4), s.slice(4, 6), s.slice(6, 8)];
  }

  const stems: string[] = [];
  const branches: string[] = [];
  for (const p of parts) {
    const chars = Array.from(p);
    if (chars.length >= 2) {
      stems.push(chars[0]!);
      branches.push(chars[1]!);
    } else if (chars.length === 1) {
      stems.push(chars[0]!);
      branches.push('');
    }
  }
  return stems.length > 0 ? { stems, branches } : null;
}

type WuXing = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

const STEM_WX: Record<string, WuXing> = {
  甲: 'wood',
  乙: 'wood',
  丙: 'fire',
  丁: 'fire',
  戊: 'earth',
  己: 'earth',
  庚: 'metal',
  辛: 'metal',
  壬: 'water',
  癸: 'water',
};

const BRANCH_WX: Record<string, WuXing> = {
  寅: 'wood',
  卯: 'wood',
  辰: 'earth',
  巳: 'fire',
  午: 'fire',
  未: 'earth',
  申: 'metal',
  酉: 'metal',
  戌: 'earth',
  亥: 'water',
  子: 'water',
  丑: 'earth',
};

/** 返回五行对应的样式类名（用于着色） */
export function wuxingClass(char: string, kind: 'stem' | 'branch'): string {
  const map = kind === 'stem' ? STEM_WX : BRANCH_WX;
  const wx = map[char];
  return wx ? `wx-${wx}` : 'wx-unknown';
}
