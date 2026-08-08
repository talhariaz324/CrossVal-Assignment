import { z } from "zod";

export const recordPaymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "paidOn must be in YYYY-MM-DD format"),
  note: z.string().trim().max(1000).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
