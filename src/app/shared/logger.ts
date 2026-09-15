import {environment} from '../../environments/environment';

export interface AppLogger {
  debug(...details: unknown[]): void;
  info(...details: unknown[]): void;
  warn(...details: unknown[]): void;
  error(...details: unknown[]): void;
}

const browserConsole = globalThis.console;
const noop: AppLogger['debug'] = () => undefined;

export const logger: AppLogger = environment.production
  ? {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  }
  : {
    debug: browserConsole.debug.bind(browserConsole),
    info: browserConsole.info.bind(browserConsole),
    warn: browserConsole.warn.bind(browserConsole),
    error: browserConsole.error.bind(browserConsole),
  };
