import { pgSchema, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

/**
 * All hospital tables live in the `hms` Postgres schema so the legacy portfolio
 * tables in `public` cannot collide with them (decision E2).
 */
export const hms = pgSchema("hms");

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const activeFlag = {
  active: boolean("active").default(true).notNull(),
};

export const idColumn = () => uuid("id").defaultRandom().primaryKey();
