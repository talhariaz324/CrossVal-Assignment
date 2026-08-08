import { z } from "zod";

const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"),
  // Client sends whole-dollar-precision decimal string/number; converted to cents in the service layer.
  unitPrice: z.number().nonnegative("Unit price must be zero or greater"),
});

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format"),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

export const updateOrderSchema = z.object({
  customerName: z.string().trim().min(1).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format")
    .optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(["pending", "partially_paid", "paid", "overdue"]).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
