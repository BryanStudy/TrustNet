import axios from "@/utils/axios";
import { useQuery } from "@tanstack/react-query";
import { DigitalThreat } from "@/types/digital-threats";

export function useDigitalThreats() {
  const { data, isLoading, refetch, isError, error } = useQuery<
    DigitalThreat[]
  >({
    queryKey: ["digital-threats"],
    queryFn: async () => {
      const res = await axios.get("/api/digital-threats/read-threats");
      return res.data.threats;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    digitalThreats: data || [],
    loading: isLoading,
    refetch,
    isError,
    error,
  };
}
