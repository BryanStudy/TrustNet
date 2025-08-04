import { useQuery } from "@tanstack/react-query";
import axios from "@/utils/axios";

interface DashboardData {
  userRegistrations: Array<{
    month: string;
    name: string;
    users: number;
  }>;
  threatStatusData: Array<{
    name: string;
    value: number;
  }>;
  stats: {
    totalUsers: number;
    totalReports: number;
    totalThreats: number;
    totalArticles: number;
    totalLikes: number;
    verifiedThreats: number;
    activeUsers: number;
  };
}

export const useDashboard = () => {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const response = await axios.get("/dashboard");
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
