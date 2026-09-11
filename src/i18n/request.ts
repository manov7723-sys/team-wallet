/**
 * Next-Intl Request Configuration
 *
 * Dynamically loads locale-specific translation messages
 * for each incoming request using Next Intl.
 *
 * Responsibilities:
 * - Determines the active locale (defaults to "en" if not provided).
 * - Dynamically imports the corresponding translation JSON file.
 * - Supplies locale and messages to the Next Intl provider.
 * @param {Object} params
 * @param {string} params.locale - The locale detected from the request.
 * @returns {Promise<{ locale: string, messages: Object }>} Locale configuration object.
 */

import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => {
  const currentLocale = locale || "en";

  return {
    locale: currentLocale,
    messages: (await import(`@/src/languages/${currentLocale}.json`)).default,
  };
});
