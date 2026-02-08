import type { CheerioAPI } from "cheerio";

/**
 * Mapping: Framer component names (data-framer-name) → semantic section names.
 *
 * Framer uses arbitrary component names like "Hero", "Features", "Footer".
 * We normalize them to consistent data-section attributes.
 */
const SECTION_MAP: Record<string, string> = {
  // Navigation
  navbar: "navbar",
  nav: "navbar",
  navigation: "navbar",
  header: "header",
  "top-bar": "navbar",
  topbar: "navbar",
  menu: "navbar",

  // Hero / Banner
  hero: "hero",
  "hero-section": "hero",
  banner: "hero",
  "hero section": "hero",
  jumbotron: "hero",
  intro: "hero",

  // Features
  features: "features",
  "features-section": "features",
  "feature-section": "features",
  benefits: "features",
  services: "features",

  // About
  about: "about",
  "about-section": "about",
  "about-us": "about",
  team: "about",
  story: "about",

  // Testimonials
  testimonials: "testimonials",
  reviews: "testimonials",
  "social-proof": "testimonials",
  quotes: "testimonials",

  // Pricing
  pricing: "pricing",
  "pricing-section": "pricing",
  plans: "pricing",

  // CTA
  cta: "cta",
  "call-to-action": "cta",
  "cta-section": "cta",
  "sign-up": "cta",

  // Contact
  contact: "contact",
  "contact-section": "contact",
  "contact-us": "contact",
  "get-in-touch": "contact",

  // FAQ
  faq: "faq",
  "faq-section": "faq",
  questions: "faq",

  // Footer
  footer: "footer",
  "footer-section": "footer",
  "site-footer": "footer",

  // Content sections
  content: "content",
  "content-section": "content",
  section: "content",
  blog: "blog",
  gallery: "gallery",
  portfolio: "portfolio",
  logos: "logos",
  partners: "logos",
  clients: "logos",
  stats: "stats",
  numbers: "stats",
  metrics: "stats",
};

/**
 * Normalize a Framer component name into a semantic section name.
 * Returns null if no match is found.
 */
function toSectionName(framerName: string): string | null {
  const key = framerName.toLowerCase().trim();
  // Direct match
  if (SECTION_MAP[key]) return SECTION_MAP[key];
  // Partial match — check if any known key is contained in the name
  for (const [pattern, section] of Object.entries(SECTION_MAP)) {
    if (key.includes(pattern)) return section;
  }
  return null;
}

/**
 * Add data-section attributes based on data-framer-name values.
 * Does NOT remove existing data-framer-name attributes.
 */
export function normalizeStructure($: CheerioAPI): void {
  $("[data-framer-name]").each((_, el) => {
    const node = $(el);
    const framerName = node.attr("data-framer-name");
    if (!framerName) return;

    const section = toSectionName(framerName);
    if (section) {
      node.attr("data-section", section);
    }
  });
}
