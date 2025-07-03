import axios from "@/utils/axios";
import { useQuery } from "@tanstack/react-query";
import { DigitalThreat } from "@/types/digital-threats";

export function useLikedDigitalThreats() {
  const { data, isLoading, refetch, isError, error } = useQuery<
    DigitalThreat[]
  >({
    queryKey: ["liked-digital-threats"],
    queryFn: async () => {
      const res = await axios.get("/api/digital-threats/read-liked-threats");
      return res.data;
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
