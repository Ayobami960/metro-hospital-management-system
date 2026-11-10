/**
 * Reference vocabularies that are not returned by the API as option lists.
 *
 * Everything else the screens filter by now comes from the backend
 * (`/reference/*`, `/departments`, `/doctors`, …) through React Query hooks, so
 * this file only holds the small fixed vocabularies that have no endpoint.
 */

/** Audit log levels written by `writeAudit({ level })`. */
export const systemLogsLevels = ["All Levels", "info", "warning", "danger", "success"];
