import { useVpnStore } from "../state/useVpnStore";
import { AppLanguage, TranslationDictionary, SUPPORTED_LANGUAGES } from "./types";
import { en } from "./locales/en";
import { vi } from "./locales/vi";
import { zh } from "./locales/zh";
import { fr } from "./locales/fr";

export * from "./types";

export const DICTIONARIES: Record<AppLanguage, TranslationDictionary> = {
  en,
  vi,
  zh,
  fr,
};

export function getDictionary(lang?: AppLanguage): TranslationDictionary {
  if (lang && lang in DICTIONARIES) {
    return DICTIONARIES[lang];
  }
  return en;
}

/**
 * Custom hook to get the active language dictionary and language switching action
 */
export function useTranslation() {
  const language = useVpnStore((state) => state.appSettings.language || "en") as AppLanguage;
  const updateAppSettings = useVpnStore((state) => state.updateAppSettings);

  const t = DICTIONARIES[language] || en;

  const setLanguage = (newLang: AppLanguage) => {
    updateAppSettings({ language: newLang });
  };

  return {
    t,
    language,
    setLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}
