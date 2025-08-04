export type DigitalThreat = {
  threatId: string;
  artifact: string;
  description: string;
  type: "email" | "phone" | "url";
  status: "verified" | "unverified";
  likes: number;
  submittedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DigitalThreats = {
  threats: DigitalThreat[];
};
