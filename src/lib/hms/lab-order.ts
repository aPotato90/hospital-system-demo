import { z } from "zod";
import {
  idSchema,
  koboSchema,
  nameSchema,
  textSchema,
  type WithId,
} from "./common";
import { LAB_ORDER_STATUSES } from "./transitions";

export const labOrderStatusSchema = z.enum(LAB_ORDER_STATUSES);

/** Stored document under users/{uid}/labOrders/{labOrderId}. */
export const labOrderSchema = z
  .object({
    consultationId: idSchema,
    patientId: idSchema,
    testId: idSchema,
    name: nameSchema,
    status: labOrderStatusSchema,
    /** Empty until resulted. */
    resultText: textSchema,
    resultedAt: z.date().nullable(),
    priceKobo: koboSchema,
  })
  .refine(
    (o) =>
      o.status === "resulted"
        ? o.resultedAt !== null && o.resultText.length > 0
        : o.resultedAt === null && o.resultText === "",
    "Only resulted orders carry a result and a result time",
  );
export type LabOrderData = z.infer<typeof labOrderSchema>;
export type LabOrder = WithId<LabOrderData>;
