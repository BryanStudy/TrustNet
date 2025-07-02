export type DigitalThreat = {
  threatId: string;
  artifact: string;
  description: string;
  type: "email" | "phone" | "url";
  status: "verified" | "unverfied";
  likes: number;
  submittedBy: string;
  createdAt: string;
  updatedAt: string;
};
