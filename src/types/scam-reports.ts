import { z } from "zod";

export type ScamReport = {
  reportId: string;
  userId: string;
  title: string;
  description: string;
  anonymized: boolean;
  image: string;
  createdAt: string;
  updatedAt: string;
  viewable: string;
};

export const createScamReportSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  anonymized: z.boolean(),
  image: z.string().min(1, "Image filename is required"),
});
