export interface MemoryDraft {
  memoryType: string;
  content: string;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function extractMemoriesFromUserText(text: string): MemoryDraft[] {
  const source = normalizeText(text);
  if (!source) {
    return [];
  }

  const results: MemoryDraft[] = [];

  const nameMatch = source.match(/我叫([\u4e00-\u9fa5A-Za-z0-9]{2,20})/);
  if (nameMatch?.[1]) {
    results.push({ memoryType: 'identity', content: `用户姓名可能是${nameMatch[1]}` });
  }

  const focusMatch = source.match(/(最近|目前|现在).{0,6}(想|希望|打算|准备)([^，。！？]{4,50})/);
  if (focusMatch?.[3]) {
    results.push({ memoryType: 'goal', content: `近期目标：${focusMatch[3]}` });
  }

  const concernMatch = source.match(/(担心|焦虑|困扰)([^，。！？]{2,50})/);
  if (concernMatch?.[0]) {
    results.push({ memoryType: 'concern', content: concernMatch[0] });
  }

  const preferenceMatch = source.match(/我(更)?(喜欢|偏好)([^，。！？]{2,50})/);
  if (preferenceMatch?.[3]) {
    results.push({ memoryType: 'preference', content: `用户偏好：${preferenceMatch[3]}` });
  }

  if (results.length === 0 && source.length >= 10) {
    results.push({
      memoryType: 'context',
      content: `对话上下文：${source.slice(0, 80)}`,
    });
  }

  return results.slice(0, 3);
}
