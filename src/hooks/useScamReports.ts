import axios from "@/utils/axios";
import { useQuery } from "@tanstack/react-query";
import { ScamReport } from "@/types/scam-reports";

export function useMyScamReports() {
  const { data, isLoading, refetch, isError, error } = useQuery<ScamReport[]>({
    queryKey: ["my-scam-reports"],
    queryFn: async () => {
      const res = await axios.get("/api/scam-reports/read-reports/my-reports");
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
