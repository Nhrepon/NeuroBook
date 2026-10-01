// Structured logging. O3. Zero-dependency by design: one JSON line per call,
// log level filtered by LOG_LEVEL. In production, front with Sentry/otel
// for shipping; the shape stays the same.
type Level = 'debug' | 'info' | 'warn' | 'error'

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const threshold: number =
  ORDER[(process.env.LOG_LEVEL as Level | undefined) ?? 'info']

function write(level: Level, msg: string, extra?: Record<string, unknown>) {
  if (ORDER[level] < threshold) return
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'neurobook-web',
    msg,
    ...extra,
  }
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  out(JSON.stringify(entry))
}

export const logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => write('debug', msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => write('info', msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => write('warn', msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => write('error', msg, extra),
}
