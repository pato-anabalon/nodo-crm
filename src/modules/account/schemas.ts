import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(2, "validation.enterYourName"),
});
