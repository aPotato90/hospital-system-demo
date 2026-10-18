import { z } from "zod";
import { departmentSchema, LIMITS, nameSchema, type WithId } from "./common";
import { roleSchema } from "./roles";

/** Stored document under users/{uid}/staff/{staffId}. */
export const staffSchema = z.object({
  name: nameSchema,
  role: roleSchema,
  department: departmentSchema,
  /** Always an example.com address: the demo never holds real contacts. */
  email: z
    .string()
    .max(LIMITS.name)
    .regex(/^[a-z0-9.+-]+@example\.com$/, "Must be an @example.com address"),
});
export type StaffData = z.infer<typeof staffSchema>;
export type Staff = WithId<StaffData>;
