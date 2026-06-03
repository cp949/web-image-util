/**
 * Development and debug mode related utilities
 */

/**
 * Check if development mode is enabled
 *
 * Development mode is determined if any of the following conditions are met:
 * - NODE_ENV is 'development'
 * - URL contains debug=true parameter (browser environment)
 * - localStorage has 'web-image-util-debug' key (browser environment)
 */
export function isDevelopmentMode(): boolean {
  // Check NODE_ENV in Node.js environment
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return true;
  }

  // Check URL parameters in browser environment
  if (typeof window !== 'undefined' && typeof URLSearchParams !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('debug') === 'true') {
        return true;
      }
    } catch {
      // Ignore URLSearchParams usage failure
    }
  }

  // Check localStorage in browser environment
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem('web-image-util-debug') !== null;
    } catch {
      // Ignore localStorage access failure
    }
  }

  return false;
}

/**
 * Console output only in debug mode
 */
export const debugLog = {
  log: (...args: any[]) => {
    if (isDevelopmentMode()) {
      console.log('[web-image-util]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopmentMode()) {
      console.warn('[web-image-util]', ...args);
    }
  },
  error: (...args: any[]) => {
    if (isDevelopmentMode()) {
      console.error('[web-image-util]', ...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopmentMode()) {
      console.debug('[web-image-util]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (isDevelopmentMode()) {
      console.info('[web-image-util]', ...args);
    }
  },
};

/**
 * Always output errors and warnings, but provide more detailed information in development mode
 */
export const productionLog = {
  warn: (...args: any[]) => {
    console.warn('[web-image-util]', ...args);
  },
  error: (...args: any[]) => {
    console.error('[web-image-util]', ...args);
  },
};
