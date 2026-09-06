/**
 * Automology's brand.
 *
 * DIRECTION
 * The product's promise is that someone is always answering. Not a robot — a
 * reliable colleague who happens not to sleep. So the identity avoids the two
 * obvious traps: cold blue tech-startup, and the warm-cream-and-terracotta
 * palette that every AI product has arrived at in the last two years.
 *
 * Instead: near-black ink on warm paper, with a single deep green that only
 * ever means "live". The green is the presence dot in the logo and the "open
 * now" indicator in the product — one colour, one meaning, used sparingly
 * enough that it still registers.
 *
 * Fraunces for display gives the wordmark a human, slightly editorial quality.
 * Instrument Sans keeps everything else quiet and legible.
 *
 * TENANT BRANDING IS SEPARATE AND ALWAYS WINS
 * These tokens are for Automology's own surfaces: the landing page, signup,
 * login, the master portal. A business's own page uses THEIR colour, never
 * ours — that's the white-label promise, and breaking it would be the fastest
 * way to lose a customer who cares about their brand.
 */

export const brand = {
  name: "Automology",
  tagline: "An AI receptionist for small businesses",

  color: {
    /** Text and dark surfaces. Not pure black — warmer, easier on the eye. */
    ink: "#12100E",
    inkSoft: "#2A2621",

    /** Backgrounds, lightest to darkest. */
    paper: "#FBFAF7",
    paperShade: "#F4F2ED",
    surface: "#FFFFFF",

    /** Text that isn't the point. */
    muted: "#66625B",
    faint: "#A5A099",

    /** Hairlines and dividers. */
    line: "#E7E3DC",

    /**
     * The signal colour. Means "live", "connected", "answering" — nothing else.
     * If it starts appearing on buttons that aren't about presence, it stops
     * meaning anything.
     */
    signal: "#1E6F5C",
    signalBright: "#4ADE9B",

    /** Something needs a human. Used rarely, so it lands when it appears. */
    alert: "#B3452F",
    alertSoft: "#FBEAE7",

    /** The default a tenant gets before they choose their own. */
    tenantDefault: "#1D6A8C",
  },

  font: {
    display: '"Fraunces", Georgia, "Times New Roman", serif',
    body: '"Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
    /** One link tag, both families, weights we actually use. */
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,560;9..144,700&family=Instrument+Sans:wght@400;500;600&display=swap",
  },

  radius: { sm: "6px", md: "11px", lg: "16px", pill: "999px" },

  logo: {
    mark: "/brand/mark.svg",
    markLight: "/brand/mark-light.svg",
    wordmark: "/brand/wordmark.svg",
    wordmarkDark: "/brand/wordmark-dark.svg",
  },
} as const;

/** Drop into a <style> tag so CSS can use the same values. */
export const brandCss = `
  --ink:${brand.color.ink};
  --ink-soft:${brand.color.inkSoft};
  --paper:${brand.color.paper};
  --paper-shade:${brand.color.paperShade};
  --surface:${brand.color.surface};
  --muted:${brand.color.muted};
  --faint:${brand.color.faint};
  --line:${brand.color.line};
  --signal:${brand.color.signal};
  --signal-bright:${brand.color.signalBright};
  --alert:${brand.color.alert};
  --font-display:${brand.font.display};
  --font-body:${brand.font.body};
  --font-mono:${brand.font.mono};
`;
