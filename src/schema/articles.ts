import { z } from "zod";

export const createArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  readTime: z.number().min(1, "Read time must be at least 1 minute"),
  coverImage: z.string().min(1, "Cover image is required"),
});

export const updateArticleSchema = createArticleSchema.partial(); 