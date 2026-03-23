import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { normalizeBaziRecord } from './chartRich.js';

type TransitLayerKey = 'year' | 'month' | 'day' | 'hour';

interface TransitHiddenStem {
  slot: string;
  stem: string;
  tenGod: string;
}

export interface TransitLayer {
  key: TransitLayerKey;
  ganZhi: string;
  stem: string;
  stemElement: string;
  stemYinYang: string;
  stemTenGod: string;
  branch: string;
  branchElement: string;
  branchYinYang: string;
  hiddenStems: TransitHiddenStem[];
  naYin: string;
  xun: string;
  kongWang: string;
  xingYun: string;
  ziZuo: string;
}

export interface TransitSnapshot {
  source: string;
  generatedAt: string;
  layers: TransitLayer[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseHiddenStems(value: unknown): TransitHiddenStem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const stem = asString(record['stem']);
      if (!stem) {
        return null;
      }
      return {
        slot: asString(record['slot']),
        stem,
        tenGod: asString(record['tenGod']),
      };
    })
    .filter((item): item is TransitHiddenStem => item !== null);
}

function parseLayer(key: TransitLayerKey, value: unknown): TransitLayer {
  const record = asRecord(value);
  const stem = asRecord(record?.['stem']);
  const branch = asRecord(record?.['branch']);
  const stemText = asString(stem?.['text']);
  const branchText = asString(branch?.['text']);

  return {
    key,
    ganZhi: `${stemText}${branchText}`.trim(),
    stem: stemText,
    stemElement: asString(stem?.['element']),
    stemYinYang: asString(stem?.['yinYang']),
    stemTenGod: asString(stem?.['tenGod']),
    branch: branchText,
    branchElement: asString(branch?.['element']),
    branchYinYang: asString(branch?.['yinYang']),
    hiddenStems: parseHiddenStems(branch?.['hiddenStems']),
    naYin: asString(record?.['naYin']),
    xun: asString(record?.['xun']),
    kongWang: asString(record?.['kongWang']),
    xingYun: asString(record?.['xingYun']),
    ziZuo: asString(record?.['ziZuo']),
  };
}

async function loadBaziMcpModule(): Promise<{ getBaziDetail: (input: Record<string, unknown>) => Promise<unknown> }> {
  await access(config.BAZI_MCP_DIST_PATH);
  const moduleUrl = pathToFileURL(config.BAZI_MCP_DIST_PATH).href;
  const moduleData = await import(moduleUrl);
  if (typeof moduleData.getBaziDetail !== 'function') {
    throw new Error(`getBaziDetail not found in ${config.BAZI_MCP_DIST_PATH}`);
  }
  return moduleData as { getBaziDetail: (input: Record<string, unknown>) => Promise<unknown> };
}

export async function getCurrentTransitSnapshot(gender?: 0 | 1 | null): Promise<TransitSnapshot> {
  const moduleData = await loadBaziMcpModule();
  const raw = await moduleData.getBaziDetail({
    solarDatetime: new Date().toISOString(),
    gender: gender === 0 || gender === 1 ? gender : 1,
    eightCharProviderSect: 2,
  });
  const normalized = normalizeBaziRecord(raw, 'bazi-mcp-local-dist');
  const root = asRecord(normalized);
  const chart = asRecord(root?.['chart_rich']);
  const pillars = asRecord(chart?.['pillars']);

  return {
    source: asString(chart?.['source']) || 'bazi-mcp',
    generatedAt: asString(chart?.['generatedAt']) || new Date().toISOString(),
    layers: [
      parseLayer('year', pillars?.['year']),
      parseLayer('month', pillars?.['month']),
      parseLayer('day', pillars?.['day']),
      parseLayer('hour', pillars?.['hour']),
    ],
  };
}
