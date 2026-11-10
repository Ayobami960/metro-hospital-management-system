/**
 * Static data that has no backend equivalent.
 *
 * Screens import from `@/data` (never from the individual files) so a dataset
 * can move between files, or be replaced by an API call / React Query hook,
 * without touching the components that render it.
 *
 * Layout of this folder:
 *   shared.ts     nav, roles, role colours/labels, portals, role home routes
 *   reference.ts  small fixed vocabularies with no endpoint (audit levels)
 *
 * Every clinical, financial and operational dataset now comes from the API; the
 * remaining `@/data` imports are navigation/role config only.
 */
export * from "./reference";
export * from "./shared";
