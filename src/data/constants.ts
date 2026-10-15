/** Fixed sets that are safe to use at build time (no seed generation). */
export const DEMO_CHURCH_SLUGS = ["grace-fellowship", "living-waters"] as const;
export type DemoChurchSlug = (typeof DEMO_CHURCH_SLUGS)[number];
export const DEFAULT_CHURCH_SLUG: DemoChurchSlug = "grace-fellowship";
export const STORE_KEY = "shepherdos-demo";
export const STORE_VERSION = 1;
