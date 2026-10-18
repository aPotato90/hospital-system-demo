import { z } from "zod";
import { roleSchema } from "./roles";

/** Sandbox state at users/{uid}/meta/state. */
export const metaStateSchema = z.object({
  seeded: z.boolean(),
  seededAt: z.date().nullable(),
  activeRole: roleSchema,
});
export type MetaState = z.infer<typeof metaStateSchema>;
