const LIGHT_FAVICON = 'assets/img/logo/logo-flat.svg';
const DARK_FAVICON = 'assets/img/logo/logo-flat-tint.svg';

export function applyThemeAssets(isDark: boolean): void {
  const favicon = document.querySelector<HTMLLinkElement>('#app-favicon');
  if (favicon) {
    favicon.href = isDark ? DARK_FAVICON : LIGHT_FAVICON;
  }
}
