import * as fs from 'fs';

export interface FunctionRange {
  name: string;
  startLine: number;
  endLine: number;
}

export interface ResolvedBreakpoint {
  line: number;
  verified: boolean;
  functionName?: string;
  message?: string;
}

const FUNCTION_DECL = /^\s*(?:pub\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;

export function parseFunctionRanges(sourcePath: string): FunctionRange[] {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const lines = source.split(/\r?\n/);
  const ranges: FunctionRange[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(FUNCTION_DECL);
    if (!match) {
      continue;
    }

    const name = match[1];
    let bodyDepth = 0;
    let bodyStarted = false;
    let endLine = index + 1;

    for (let cursor = index; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;

      if (opens > 0) {
        bodyStarted = true;
      }

      bodyDepth += opens - closes;
      endLine = cursor + 1;

      if (bodyStarted && bodyDepth <= 0) {
        break;
      }
    }

    ranges.push({
      name,
      startLine: index + 1,
      endLine
    });
  }

  return ranges;
}

export function resolveSourceBreakpoints(
  sourcePath: string,
  lines: number[],
  exportedFunctions: Set<string>
): ResolvedBreakpoint[] {
  const ranges = parseFunctionRanges(sourcePath);

  return lines.map((line) => {
    const range = ranges.find((candidate) => line >= candidate.startLine && line <= candidate.endLine);
    if (!range) {
      return {
        line,
        verified: false,
        message: 'Line is not inside a detectable Rust function'
      };
    }

    if (!exportedFunctions.has(range.name)) {
      return {
        line,
        verified: false,
        functionName: range.name,
        message: `Rust function '${range.name}' is not an exported contract entrypoint`
      };
    }

    return {
      line,
      verified: true,
      functionName: range.name,
      message: `Mapped to contract function '${range.name}' entry breakpoint`
    };
  });
}
