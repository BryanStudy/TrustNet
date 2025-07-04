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
