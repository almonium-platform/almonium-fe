import {logger} from './app/shared/logger';
import {environment} from './environments/environment';
import {applyUiLocale, readUiLocalePreference, resolveUiLocale} from './app/services/ui-locale';

/**
 * The interface language is settled before the app is imported: `$localize` strings in module-level constants
 * evaluate on import, and they need the translations loaded by then. English needs no file and no wait.
 */
async function bootstrap(): Promise<void> {
  const devMode = !environment.production;
  const locale = resolveUiLocale(readUiLocalePreference(window.localStorage, devMode), navigator.languages, devMode);
  await applyUiLocale(locale, (message, error) => logger.warn(message, error));

  const [{bootstrapApplication}, {AppComponent}, {appConfig}] = await Promise.all([
    import('@angular/platform-browser'),
    import('./app/app.component'),
    import('./app/app.config'),
  ]);
  await bootstrapApplication(AppComponent, appConfig);
}

bootstrap().catch((err: unknown) => logger.error(err));
