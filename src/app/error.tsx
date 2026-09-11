"use client";
/**
 * @component Error
 *
 * Global Next.js error boundary shown when an unhandled exception is
 * thrown anywhere in the app tree. Logs the error to the console and
 * renders a reset button to attempt recovery without a full page reload.
 */
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect } from "react";
import Button from "../components/Button/ButtonVW";
import logger from "../lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  useEffect(() => {
    logger.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="bg-base-100 flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center" role="alert">
        <div className="bg-error/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="text-error h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h3 className="text-base-content">{t("Something went wrong")}</h3>
        <p className="text-neutral-content mt-3">
          {t("An unexpected error occurred This has been logged and our team will look into it")}
          {error.digest && (
            <span className="mt-1 block text-xs opacity-50">
              {t("Reference")} {error.digest}
            </span>
          )}
        </p>

        <div className="mt-8 flex flex-row items-center justify-center gap-3 sm:justify-center">
          <Button label="Try again" onClick={reset} variant="primary" className="max-sm:flex-1" />

          <Link href="/" className="btn btn-secondary btn-md max-sm:flex-1">
            {t("Back to Home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
