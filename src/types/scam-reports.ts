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

export type ScamReportWithUserDetail = ScamReport & {
  reporterName: string;
  reporterPicture: string;
};
