import {z} from "zod";

export const moneySchema = z.object({
    currency: z.string().length(3),
    amount: z.number().int().nonnegative()
})

export const lineItemsSchema = z.object({
    label: z.string().min(1).max(120),
    amount: z.number().int(),
    type: z.enum(["final", "pending"]).optional()
})

export const paymentRequestSchema = z.object({
    idempotencyKey: z.string().uuid().optional(),
    reference: z.string().min(1).max(64),
    total: moneySchema,
    lineItems: z.array(lineItemsSchema).optional(),
    description: z.string().max(280).optional(),
    countryCode: z.string().length(2),
    supportedCountries: z.array(z.string().length(2)).optional(),
    supportedNetworks: z.array(z.enum(["visa", "mastercard", "amex", "discover", "interac", "jcb", "unionpay", "mada", "elo"])).optional(),
    metadata: z.record(z.string()).optional()
})

export type paymentRequestInput = z.input<typeof paymentRequestSchema>;