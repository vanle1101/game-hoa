import { z } from "zod";
import { actionSchema, taskInputSchema } from "@/domain/validation";
export { taskInputSchema as taskInput };
export const commandSchema=z.object({key:z.string().uuid(),action:actionSchema,expectedOwnerId:z.string().min(1).max(200).optional()}).strict();
