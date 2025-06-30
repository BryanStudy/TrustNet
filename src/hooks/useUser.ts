"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import axios from "@/utils/axios";
import { useQuery } from "@tanstack/react-query";

// Only keep local user state and backend API calls

export type UserInfo = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  createdAt: string;
  role: "admin" | "customer";
};

export function useUser() {
  const { data, isLoading, refetch, isError, error } = useQuery<UserInfo>({
    queryKey: ["current-user"],
    queryFn: async () => {
      const res = await axios.get("/api/me");
      return res.data.user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2, // if res failed, retry 2 times before giving up and returning error
  });

  return {
    userInfo: data,
    loading: isLoading,
    refetch,
    isError,
    error,
  };
}
