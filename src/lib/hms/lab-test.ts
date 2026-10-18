import { z } from "zod";
import { koboSchema, labelSchema, nameSchema, type WithId } from "./common";

/** Lab test catalogue entry under users/{uid}/labTests/{testId}. */
export const labTestSchema = z.object({
  name: nameSchema,
  category: labelSchema,
  priceKobo: koboSchema,
});
export type LabTestData = z.infer<typeof labTestSchema>;
export type LabTest = WithId<LabTestData>;
