const levels = ['error', 'warn', 'info', 'debug'] as const;
type Level = (typeof levels)[number];

function format(level: Level, message: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const argsStr = args.length > 0 ? args.map(a => JSON.stringify(a)).join(' ') : '';
  return `${timestamp} [${level.toUpperCase()}]: ${message} ${argsStr}`;
}

export const logger = {
  error: (message: string, ...args: unknown[]) =>
    console.error(format('error', message, ...args)),
  warn: (message: string, ...args: unknown[]) =>
    console.warn(format('warn', message, ...args)),
  info: (message: string, ...args: unknown[]) =>
    console.info(format('info', message, ...args)),
  debug: (message: string, ...args: unknown[]) =>
    console.debug(format('debug', message, ...args)),
};
