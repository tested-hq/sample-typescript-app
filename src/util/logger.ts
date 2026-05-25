// Minimal console-backed logger with a runtime level filter. Real apps would
// reach for pino/winston; this one stays dependency-free so the sample install
// is small. Kept intentionally without tests — it's a `tested diff` target.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let currentLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel | undefined) ?? 'info';

export function setLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[currentLevel];
}

function format(level: LogLevel, msg: string, meta: Record<string, unknown> | undefined): string {
  const ts = new Date().toISOString();
  if (meta && Object.keys(meta).length > 0) {
    return `${ts} ${level.toUpperCase()} ${msg} ${JSON.stringify(meta)}`;
  }
  return `${ts} ${level.toUpperCase()} ${msg}`;
}

export function debug(msg: string, meta?: Record<string, unknown>): void {
  if (!shouldLog('debug')) return;
  // eslint-disable-next-line no-console
  console.debug(format('debug', msg, meta));
}

export function info(msg: string, meta?: Record<string, unknown>): void {
  if (!shouldLog('info')) return;
  // eslint-disable-next-line no-console
  console.info(format('info', msg, meta));
}

export function warn(msg: string, meta?: Record<string, unknown>): void {
  if (!shouldLog('warn')) return;
  // eslint-disable-next-line no-console
  console.warn(format('warn', msg, meta));
}

export function error(msg: string, meta?: Record<string, unknown>): void {
  if (!shouldLog('error')) return;
  // eslint-disable-next-line no-console
  console.error(format('error', msg, meta));
}
