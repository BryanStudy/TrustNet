"use client";

import axios from "@/utils/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

// Only keep local user state and backend API calls

export type UserInfo = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  createdAt: string;
  updatedAt?: string;
  role: "admin" | "customer";
};

type ErrorResponse = { error: string };

export function useUser() {
  const { data, isLoading, refetch, isError, error } = useQuery<UserInfo>({
    queryKey: ["current-user"],
    queryFn: async () => {
      const res = await axios.get("/me");
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

export function useUsers() {
  const {
    data: users = [],
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery<UserInfo[], AxiosError<ErrorResponse>>({
    queryKey: ["users"],
    queryFn: async () => {
      try {
        const response = await axios.get("/users");
        return response.data.users;
      } catch (err) {
        const error = err as AxiosError<ErrorResponse>;
        // Handle specific error cases
        if (error.response?.status === 401) {
          throw new Error("Unauthorized - Please log in");
        }
        if (error.response?.status === 403) {
          throw new Error("Forbidden - Admin access required");
        }
        // Handle the error message from the API
        throw new Error(error.response?.data?.error || "Failed to fetch users");
      }
    },
  });

  return {
    users,
    loading,
    isError,
    error,
    refetch,
  };
}

export function useUserById(userId: string | undefined) {
  const { data, isLoading, refetch, isError, error } = useQuery<UserInfo>({
    queryKey: ["user", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      const res = await axios.get(`/users/${userId}`);
      return res.data.user;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  return {
    user: data,
    loading: isLoading,
    refetch,
    isError,
    error,
  };
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: Partial<UserInfo>;
    }) => {
      const response = await axios.patch(`/users/${userId}`, data);
      return response.data.user;
    },
    onSuccess: (updatedUser) => {
      // Invalidate and refetch user queries
      queryClient.invalidateQueries({ queryKey: ["user", updatedUser.userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await axios.delete(`/users/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all cache (including threats, scam reports, literacy hub, etc)
      queryClient.invalidateQueries();
    },
  });
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export const passwordRequirements = [
  { regex: /.{8,}/, text: "At least 8 characters" },
  { regex: /[0-9]/, text: "Contains at least 1 number" },
  { regex: /[a-z]/, text: "Contains at least 1 lowercase letter" },
  { regex: /[A-Z]/, text: "Contains at least 1 uppercase letter" },
  { regex: /[^A-Za-z0-9]/, text: "Contains at least 1 special character" },
];

export function validatePassword(password: string): boolean {
  return passwordRequirements.every((req) => req.regex.test(password));
}

// Reusable image upload hook
export function useImageUpload(folderPath: string) {
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const uploadImage = async (file: File): Promise<string | null> => {
    setImageUploading(true);
    setImageError(null);
    try {
      const presignedUrlResponse = await fetch("/s3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: uuidv4() + "-" + file.name,
          contentType: file.type,
          size: file.size,
          folderPath,
        }),
      });
      if (!presignedUrlResponse.ok) {
        setImageUploading(false);
        setImageError("Failed to get presigned URL");
        toast.error("Failed to get presigned URL");
        return null;
      }
      const { presignedUrl, fileName } = await presignedUrlResponse.json();
      await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      setImageUploading(false);
      toast.success("Image uploaded successfully");
      return fileName;
    } catch (err) {
      setImageUploading(false);
      setImageError("Failed to upload image");
      toast.error("Failed to upload image");
      return null;
    }
  };

  const removeImage = async (fileName: string): Promise<boolean> => {
    if (!fileName) return false;
    try {
      await fetch("/s3", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: fileName,
          folderPath,
        }),
      });
      toast.success("Image removed successfully");
      return true;
    } catch (err) {
      toast.error("Failed to remove image");
      return false;
    }
  };

  const validateImageFile = (file: File): boolean => {
    if (!file.type.startsWith("image/")) {
      setImageError("Only image files are allowed");
      toast.error("Only image files are allowed");
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image size must be under 5MB");
      toast.error("Image size must be under 5MB");
      return false;
    }
    return true;
  };

  return {
    imageUploading,
    imageError,
    uploadImage,
    removeImage,
    validateImageFile,
  };
}
