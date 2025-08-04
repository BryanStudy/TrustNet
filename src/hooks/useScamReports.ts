import axios from "@/utils/axios";
import { useQuery } from "@tanstack/react-query";
import { ScamReport, ScamReportWithUserDetail } from "@/types/scam-reports";

export function useMyScamReports() {
  const { data, isLoading, refetch, isError, error } = useQuery<ScamReport[]>({
    queryKey: ["my-scam-reports"],
    queryFn: async () => {
      const res = await axios.get("/scam-reports/read-reports/my-reports");
      return res.data.reports;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    scamReports: data || [],
    loading: isLoading,
    refetch,
    isError,
    error,
  };
}

export function useScamReport(reportId: string, createdAt: string) {
  const { data, isLoading, refetch, isError, error } = useQuery<{
    report: ScamReport;
  }>({
    queryKey: ["scam-report", reportId, createdAt],
    queryFn: async () => {
      const res = await axios.get(
        `/scam-reports/read-reports/${reportId}?createdAt=${encodeURIComponent(
          createdAt
        )}`
      );
      return res.data as { report: ScamReport };
    },
    enabled: !!reportId && !!createdAt,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    report: data ? data.report : undefined,
    loading: isLoading,
    refetch,
    isError,
    error,
  };
}

export function useScamReportsWithUserDetail(
  limit: number = 6,
  lastEvaluatedKey?: any
) {
  const { data, isLoading, refetch, isError, error } = useQuery<{
    reports: ScamReportWithUserDetail[];
    lastEvaluatedKey: any;
  }>({
    queryKey: ["scam-reports-with-user-detail", limit, lastEvaluatedKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (lastEvaluatedKey) {
        params.set("lastEvaluatedKey", JSON.stringify(lastEvaluatedKey));
      }
      const res = await axios.get(
        `/scam-reports/read-reports?${params.toString()}`
      );
      return res.data as {
        reports: ScamReportWithUserDetail[];
        lastEvaluatedKey: any;
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    reports: data?.reports || [],
    lastEvaluatedKey: data?.lastEvaluatedKey,
    loading: isLoading,
    refetch,
    isError,
    error,
  };
}

export function useSearchedScamReports(
  title: string,
  limit: number = 6,
  lastEvaluatedKey?: any
) {
  const { data, isLoading, refetch, isError, error } = useQuery<{
    reports: ScamReportWithUserDetail[];
    lastEvaluatedKey: any;
  }>({
    queryKey: ["searched-scam-reports", title, limit, lastEvaluatedKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("title", title);
      params.set("limit", String(limit));
      if (lastEvaluatedKey) {
        params.set("lastEvaluatedKey", JSON.stringify(lastEvaluatedKey));
      }
      const res = await axios.get(
        `/scam-reports/search-reports?${params.toString()}`
      );
      return res.data as {
        reports: ScamReportWithUserDetail[];
        lastEvaluatedKey: any;
      };
    },
    enabled: !!title,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    reports: data?.reports || [],
    lastEvaluatedKey: data?.lastEvaluatedKey,
    loading: isLoading,
    refetch,
    isError,
    error,
  };
}

export function useScamReportWithUserDetail(
  reportId: string,
  createdAt: string
) {
  const { data, isLoading, refetch, isError, error } = useQuery<{
    report: ScamReportWithUserDetail;
  }>({
    queryKey: ["scam-report-with-user-detail", reportId, createdAt],
    queryFn: async () => {
      const res = await axios.get(
        `/scam-reports/read-reports/${reportId}/with-user-detail?createdAt=${encodeURIComponent(
          createdAt
        )}`
      );
      return res.data as { report: ScamReportWithUserDetail };
    },
    enabled: !!reportId && !!createdAt,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    report: data?.report,
    loading: isLoading,
    refetch,
    isError,
    error,
  };
}
