// Supported-language config. To add one: drop src/locales/{code}.json and add an entry below.

export interface LanguageMetadata {
  /** ISO 639-1 language code */
  code: string;
  /** Native language name (e.g., "Italiano" for Italian) */
  name: string;
  /** Flag emoji for visual identification */
  flag: string;
}

// Supported languages: { code: 'xx', name: 'Native Name', flag: '🇽🇽' }
const LANGUAGES: LanguageMetadata[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'pt-BR', name: 'Português do Brasil', flag: '🇧🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'sl', name: 'Slovenščina', flag: '🇸🇮' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

/**
 * Auto language option - name is set dynamically in UI via translation
 */
const AUTO_LANGUAGE: LanguageMetadata = {
  code: 'auto',
  name: '',  // Will be translated in UI
  flag: '🌐',
};

export const SUPPORTED_LANGUAGES: LanguageMetadata[] = [
  AUTO_LANGUAGE,
  ...LANGUAGES.sort((a, b) => a.name.localeCompare(b.name))
];

/**
 * Get a list of all supported language codes
 */
export function getSupportedLanguageCodes(): string[] {
  return SUPPORTED_LANGUAGES.map((lang) => lang.code);
}

/**
 * Get metadata for a specific language by its code
 */
export function getLanguageByCode(code: string): LanguageMetadata | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

/**
 * Get the default language (English)
 */
export function getDefaultLanguage(): string {
  return 'en';
}

/**
 * Extract language code from locale string
 * e.g., "en-US" -> "en", "it-IT" -> "it"
 */
export function getLanguageFromLocale(locale: string): string {
  const lang = locale.split('-')[0].toLowerCase();
  return getSupportedLanguageCodes().includes(lang) ? lang : getDefaultLanguage();
}
