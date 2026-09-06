/**
 * The Automology lockup.
 *
 * The mark is an SVG file; the word is HTML text. That split matters: an SVG
 * loaded through <img> is isolated and cannot fetch a web font, so a wordmark
 * baked into the file would silently fall back to Georgia. Composing it here
 * means Fraunces actually renders, and the text stays selectable and readable
 * to a screen reader.
 */

import { brand } from "@/lib/brand";

export function Logo({ dark = false, size = 28, markOnly = false }:
  { dark?: boolean; size?: number; markOnly?: boolean }) {
  const mark = dark ? brand.logo.markLight : brand.logo.mark;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: size * 0.42,
      textDecoration: "none", lineHeight: 1,
    }}>
      <img src={mark} alt="" aria-hidden width={size * 1.35} height={size * 1.35}
           style={{ display: "block", borderRadius: size * 0.34 }} />
      {!markOnly && (
        <span style={{
          fontFamily: brand.font.display,
          fontWeight: 600,
          fontSize: size,
          letterSpacing: "-0.03em",
          color: dark ? brand.color.paper : brand.color.ink,
        }}>
          Automology
        </span>
      )}
    </span>
  );
}
