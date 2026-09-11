/**
 * @component Loading
 *
 * Global Next.js Suspense fallback rendered while a page segment is
 * loading. Displays a full-screen centered spinner with an accessible
 * aria-label and role="status".
 */

import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("create");
  return (
    <div
      className="bg-base-100 flex min-h-screen items-center justify-center"
      role="status"
      aria-label="Loading page"
    >
      <div className="text-center">
        <div className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />
        <p className="text-neutral-content mt-3 text-sm">{t("Loading")}</p>
      </div>
    </div>
  );
}
