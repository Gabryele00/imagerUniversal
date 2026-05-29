// Persistent settings access via the Tauri Store plugin (no backend commands)

import { load } from '@tauri-apps/plugin-store';
import { CACHE, SETTINGS } from '../config';
let storeInstance: Awaited<ReturnType<typeof load>> | null = null;
let storePromise: Promise<Awaited<ReturnType<typeof load>>> | null = null;

// Lazily load the store, caching the in-flight promise to avoid concurrent re-init
async function getStore() {
  if (storeInstance) {
    return storeInstance;
  }

  if (!storePromise) {
    storePromise = load(SETTINGS.FILE, { autoSave: true, defaults: {} })
      .then(store => {
        storeInstance = store;
        storePromise = null;
        return store;
      })
      .catch(error => {
        storePromise = null;
        throw new Error(`Failed to initialize settings store: ${error}`);
      });
  }

  return storePromise;
}

/** Get the theme preference ('auto', 'light', or 'dark') */
export async function getTheme(): Promise<string> {
  try {
    const store = await getStore();
    return (await store.get<string>(SETTINGS.KEYS.THEME)) || SETTINGS.DEFAULTS.THEME;
  } catch (error) {
    throw new Error(`Failed to get theme: ${error}`);
  }
}

/** Set the theme preference ('auto', 'light', or 'dark') */
export async function setTheme(theme: string): Promise<void> {
  try {
    const store = await getStore();
    await store.set(SETTINGS.KEYS.THEME, theme);
    await store.save();
  } catch (error) {
    throw new Error(`Failed to set theme: ${error}`);
  }
}

/** Get the language preference (e.g. 'en', 'de', 'fr') */
export async function getLanguage(): Promise<string> {
  try {
    const store = await getStore();
    return (await store.get<string>(SETTINGS.KEYS.LANGUAGE)) || SETTINGS.DEFAULTS.LANGUAGE;
  } catch (error) {
    throw new Error(`Failed to get language: ${error}`);
  }
}

/** Set the language preference (e.g. 'en', 'de', 'fr') */
export async function setLanguage(language: string): Promise<void> {
  try {
    const store = await getStore();
    await store.set(SETTINGS.KEYS.LANGUAGE, language);
    await store.save();
  } catch (error) {
    throw new Error(`Failed to set language: ${error}`);
  }
}

/** Get the MOTD visibility preference */
export async function getShowMotd(): Promise<boolean> {
  try {
    const store = await getStore();
    const value = await store.get<boolean>(SETTINGS.KEYS.SHOW_MOTD);
    return value ?? SETTINGS.DEFAULTS.SHOW_MOTD;
  } catch (error) {
    throw new Error(`Failed to get MOTD preference: ${error}`);
  }
}

/** Set the MOTD visibility preference */
export async function setShowMotd(show: boolean): Promise<void> {
  try {
    const store = await getStore();
    await store.set(SETTINGS.KEYS.SHOW_MOTD, show);
    await store.save();
  } catch (error) {
    throw new Error(`Failed to set MOTD preference: ${error}`);
  }
}

/** Get the updater modal visibility preference */
export async function getShowUpdaterModal(): Promise<boolean> {
  try {
    const store = await getStore();
    const value = await store.get<boolean>(SETTINGS.KEYS.SHOW_UPDATER_MODAL);
    return value ?? SETTINGS.DEFAULTS.SHOW_UPDATER_MODAL;
  } catch (error) {
    throw new Error(`Failed to get updater modal preference: ${error}`);
  }
}

/** Set the updater modal visibility preference */
export async function setShowUpdaterModal(show: boolean): Promise<void> {
  try {
    const store = await getStore();
    await store.set(SETTINGS.KEYS.SHOW_UPDATER_MODAL, show);
    await store.save();
  } catch (error) {
    throw new Error(`Failed to set updater modal preference: ${error}`);
  }
}

/** Get the developer mode preference */
export async function getDeveloperMode(): Promise<boolean> {
  try {
    const store = await getStore();
    const value = await store.get<boolean>(SETTINGS.KEYS.DEVELOPER_MODE);
    return value ?? SETTINGS.DEFAULTS.DEVELOPER_MODE;
  } catch (error) {
    throw new Error(`Failed to get developer mode preference: ${error}`);
  }
}

/** Set developer mode, which controls debug logging verbosity */
export async function setDeveloperMode(enabled: boolean): Promise<void> {
  try {
    const store = await getStore();
    await store.set(SETTINGS.KEYS.DEVELOPER_MODE, enabled);
    await store.save();
  } catch (error) {
    throw new Error(`Failed to set developer mode preference: ${error}`);
  }
}

/** Get the skip-verification preference */
export async function getSkipVerify(): Promise<boolean> {
  try {
    const store = await getStore();
    const value = await store.get<boolean>(SETTINGS.KEYS.SKIP_VERIFY);
    return value ?? SETTINGS.DEFAULTS.SKIP_VERIFY;
  } catch (error) {
    throw new Error(`Failed to get skip verify preference: ${error}`);
  }
}

/** Set the skip-verification preference (skips the post-flash check for speed) */
export async function setSkipVerify(skip: boolean): Promise<void> {
  try {
    const store = await getStore();
    await store.set(SETTINGS.KEYS.SKIP_VERIFY, skip);
    await store.save();
  } catch (error) {
    throw new Error(`Failed to set skip verify preference: ${error}`);
  }
}

// ============================================================================
// Cache Settings
// ============================================================================

// The Rust backend owns the canonical cache-size default; values here are
// only fallbacks for when the backend cannot be reached.

/** Get the cache enabled preference */
export async function getCacheEnabled(): Promise<boolean> {
  try {
    const store = await getStore();
    const value = await store.get<boolean>(SETTINGS.KEYS.CACHE_ENABLED);
    return value ?? SETTINGS.DEFAULTS.CACHE_ENABLED;
  } catch (error) {
    throw new Error(`Failed to get cache enabled preference: ${error}`);
  }
}

/**
 * Set the cache enabled preference.
 * When enabled, downloaded images are kept for faster retry instead of deleted after flash.
 */
export async function setCacheEnabled(enabled: boolean): Promise<void> {
  try {
    const store = await getStore();
    await store.set(SETTINGS.KEYS.CACHE_ENABLED, enabled);
    await store.save();
  } catch (error) {
    throw new Error(`Failed to set cache enabled preference: ${error}`);
  }
}

/**
 * Get the maximum cache size in bytes, falling back to the backend default when unset.
 */
export async function getCacheMaxSize(): Promise<number> {
  try {
    const store = await getStore();
    const value = await store.get<number>(SETTINGS.KEYS.CACHE_MAX_SIZE);
    return value ?? CACHE.DEFAULT_SIZE;
  } catch (error) {
    throw new Error(`Failed to get cache max size: ${error}`);
  }
}

/** Set the max cache size in bytes; older images are evicted past this limit */
export async function setCacheMaxSize(size: number): Promise<void> {
  try {
    const store = await getStore();
    await store.set(SETTINGS.KEYS.CACHE_MAX_SIZE, size);
    await store.save();
  } catch (error) {
    throw new Error(`Failed to set cache max size: ${error}`);
  }
}

// ============================================================================
// Armbian Board Detection Settings
// ============================================================================

/**
 * Get the Armbian board detection mode: "disabled" (off),
 * "modal" (confirm before auto-select), or "auto" (no confirmation).
 */
export async function getArmbianBoardDetection(): Promise<string> {
  try {
    const store = await getStore();
    return (
      (await store.get<string>(SETTINGS.KEYS.ARMBIAN_BOARD_DETECTION)) ||
      SETTINGS.DEFAULTS.ARMBIAN_BOARD_DETECTION
    );
  } catch (error) {
    throw new Error(`Failed to get Armbian board detection preference: ${error}`);
  }
}

/** Set the Armbian board detection mode ('disabled', 'modal', or 'auto') */
export async function setArmbianBoardDetection(mode: string): Promise<void> {
  if (!['disabled', 'modal', 'auto'].includes(mode)) {
    throw new Error(
      `Invalid Armbian board detection mode: ${mode}. Must be 'disabled', 'modal', or 'auto'`
    );
  }

  try {
    const store = await getStore();
    await store.set(SETTINGS.KEYS.ARMBIAN_BOARD_DETECTION, mode);
    await store.save();
  } catch (error) {
    throw new Error(`Failed to set Armbian board detection preference: ${error}`);
  }
}
