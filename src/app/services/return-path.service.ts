import {Injectable} from '@angular/core';

const STORAGE_KEY = 'almonium.returnPath';

/**
 * Where to land once an account exists. A shared deck asks a stranger to sign up while the deck is on screen, and
 * the whole point is that they come back to it - after the OAuth round trip, and after onboarding - rather than to
 * a generic home. Only same-origin paths are kept, so a link can never send someone off the site.
 */
@Injectable({providedIn: 'root'})
export class ReturnPathService {
  remember(path: string): void {
    if (!isSafePath(path)) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, path);
    } catch {
      // Storage may be unavailable in a private window; the user then lands on home, which is only less convenient.
    }
  }

  /** The remembered path, left in place: a new account still has onboarding to get through first. */
  peek(): string | null {
    try {
      const path = sessionStorage.getItem(STORAGE_KEY);
      return path && isSafePath(path) ? path : null;
    } catch {
      return null;
    }
  }

  /** The remembered path, forgotten once read, so it is honoured exactly once. */
  consume(): string | null {
    const path = this.peek();
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
    return path;
  }
}

export function isSafePath(path: string): boolean {
  return /^\/(?!\/)[^\s]*$/.test(path);
}
