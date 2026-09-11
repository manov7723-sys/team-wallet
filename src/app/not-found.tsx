/**
 * @component NotFound
 *
 * Next.js 404 page rendered when a route cannot be matched.
 * Provides navigation links back to the dashboard and the landing page,
 * and sets a "Page Not Found" metadata title for the browser tab.
 */
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function NotFound() {
  const t = useTranslations("error");
  return (
    <div className="bg-base-100 flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-primary text-7xl font-bold">{t("404")}</h1>

        <h3 className="text-base-content mt-4">{t("Page not found")}</h3>
        <p className="text-neutral-content mt-3">{t("pageNotFoundDesc")}</p>

        <div className="mt-8 flex flex-row items-center justify-center gap-3 sm:justify-center">
          <Link href="/dashboard" className="btn btn-primary btn-md max-md:flex-1">
            {t("Go to Dashboard")}
          </Link>
          <Link href="/" className="btn btn-secondary btn-md max-md:flex-1">
            {t("Back to Home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
