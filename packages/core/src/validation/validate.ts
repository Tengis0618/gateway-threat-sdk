import type { ZodSchema } from "zod";
import { GatewayError } from "../types/error";

export function validate<T>(schema: ZodSchema<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
        const messages = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        throw GatewayError.validation(messages);
    }
    return result.data;
} 