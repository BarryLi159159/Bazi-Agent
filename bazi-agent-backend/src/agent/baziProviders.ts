import { access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { parseBaziMasterOutput } from './baziMasterParser.js';
import type { BaziInput, BaziProvider } from './types.js';

const execFileAsync = promisify(execFile);

export class LocalBaziMcpDistProvider implements BaziProvider {
  readonly name = 'bazi-mcp-local-dist';
  constructor(private readonly distPath: string) {}

  async getBaziDetail(input: BaziInput): Promise<unknown> {
    await access(this.distPath);
    const moduleUrl = pathToFileURL(this.distPath).href;
    const moduleData = await import(moduleUrl);

    if (typeof moduleData.getBaziDetail !== 'function') {
      throw new Error(`getBaziDetail not found in ${this.distPath}`);
    }

    return moduleData.getBaziDetail(input);
  }
}

export class PythonBaziProvider implements BaziProvider {
  readonly name = 'bazi-master-python';
  constructor(
    private readonly scriptPath: string,
    private readonly pythonBin: string,
  ) {}

  async getBaziDetail(input: BaziInput): Promise<unknown> {
    if (!input.solarDatetime) {
      throw new Error('Python provider currently requires solarDatetime.');
    }

    const matched = input.solarDatetime.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\\s](\d{1,2})/);
    if (!matched) {
      throw new Error('Invalid solarDatetime format for Python provider.');
    }

    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const hour = Number(matched[4]);

    if ([year, month, day, hour].some((value) => Number.isNaN(value))) {
      throw new Error('Invalid solarDatetime value for Python provider.');
    }

    const args = [
      this.scriptPath,
      String(year),
      String(month),
      String(day),
      String(hour),
      '-g',
    ];

    if (input.gender === 0) {
      args.push('-n');
    }

    const { stdout, stderr } = await execFileAsync(this.pythonBin, args, {
      maxBuffer: 5 * 1024 * 1024,
      cwd: config.PROJECT_ROOT,
    });

    const structured = parseBaziMasterOutput(stdout.trim());
    return {
      ...structured,
      provider: this.name,
      solarDatetime: input.solarDatetime,
      warnings: stderr.trim() || undefined,
    };
  }
}

export function buildBaziProviders(): BaziProvider[] {
  return [
    new LocalBaziMcpDistProvider(config.BAZI_MCP_DIST_PATH),
    new PythonBaziProvider(config.BAZI_MASTER_SCRIPT_PATH, config.BAZI_MASTER_PYTHON_BIN),
  ];
}
