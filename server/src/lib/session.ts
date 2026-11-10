import { db } from "../db/client.js";

export const authDb = db;
export type AuthDb = typeof db;
