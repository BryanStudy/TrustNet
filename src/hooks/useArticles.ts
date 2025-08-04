import axios from "@/utils/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Fetch all articles
export function useArticles() {
  const { data, isLoading, refetch, isError, error } = useQuery({
    queryKey: ["articles"],
    queryFn: async () => {
      const res = await axios.get("/literacy-hub/read-articles");
      return res.data.articles;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    articles: data || [],
    loading: isLoading,
    refetch,
    isError,
    error,
  };
}

// Fetch a single article by articleId
export function useArticle(articleId?: string) {
  const queryClient = useQueryClient();
  const { data, refetch, isError, error, isSuccess } = useQuery({
    queryKey: ["article", articleId],
    queryFn: async () => {
      if (!articleId) throw new Error("No articleId provided");
      const res = await axios.get(`/literacy-hub/read-article/${articleId}`);
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      return res.data.article;
    },
    enabled: !!articleId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    article: data,
    isSuccess: isSuccess,
    refetch,
    isError,
    error,
  };
}

// Create an article
export function useCreateArticle() {
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await axios.post("/literacy-hub/create-article", data);
      return res.data;
    },
  });

  return {
    createArticle: mutation.mutateAsync,
    isLoading: mutation.status === "pending",
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// Update an article
export function useUpdateArticle() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({
      articleId,
      data,
    }: {
      articleId: string;
      data: any;
    }) => {
      const res = await axios.patch(
        `/literacy-hub/update-article/${articleId}`,
        data
      );
      return res.data.article;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["articles"] });
    },
  });

  return {
    updateArticle: mutation.mutateAsync,
    isLoading: mutation.status === "pending",
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// Delete an article
export function useDeleteArticle() {
  const mutation = useMutation({
    mutationFn: async (articleId: string) => {
      const res = await axios.delete(
        `/literacy-hub/delete-article/${articleId}`
      );
      return res.data;
    },
  });

  return {
    deleteArticle: mutation.mutateAsync,
    isLoading: mutation.status === "pending",
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}
