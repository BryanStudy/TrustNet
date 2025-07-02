import { z } from "zod";

export const createDigitalThreatSchema = z.object({
  artifact: z.string().min(1, "Artifact is required"),
  type: z.enum(["url", "email", "phone"]),
  description: z.string().min(1, "Description is required"),
});
