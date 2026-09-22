export { STARTER_BLUEPRINTS } from "./blueprints";
export type { SlotColor, SlotFont, StarterBlueprint, StarterField } from "./types";

/** Bumped when a new starter is added or an existing design changes shape.
 * Stamped into autobuildMeta.starterVersion; the restore action seeds any
 * starterKey a tenant is missing, which is how a bump reaches existing
 * tenants. */
export const STARTER_VERSION = 1;
