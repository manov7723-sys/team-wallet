"use client";
/**
 * @component FooterVW
 *
 * Sticky bottom footer rendered on all pages.
 * Displays the Tecneural copyright notice with role="contentinfo"
 * for accessibility.
 */
import { useTranslations } from "next-intl";

export default function FooterVW() {
  const t = useTranslations("footer");
  return (
    <footer
      className="footer sm:footer-horizontal footer-center bg-base-100 text-base-content border-border sticky bottom-0 z-10 border-t p-[1.344rem]"
      role="contentinfo"
    >
      <p className="text-[0.813rem]">{t("Copyright Tecneural All Rights Reserved")}</p>
    </footer>
  );
}
