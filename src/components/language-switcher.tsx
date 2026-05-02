"use client";

import { useTranslation } from "@/context/language-context";
import { Language } from "@/lib/i18n/translations";

export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      className="bg-transparent border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-green-500 dark:focus:border-green-500"
    >
      <option value="en">English</option>
      <option value="kn">ಕನ್ನಡ (Kannada)</option>
      <option value="hi">हिंदी (Hindi)</option>
      <option value="te">తెలుగు (Telugu)</option>
      <option value="ta">தமிழ் (Tamil)</option>
    </select>
  );
}
