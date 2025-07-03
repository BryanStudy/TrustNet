import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "@/utils/axios";
import { useCallback } from "react";

export function useThreatLike({
  threatId,
  createdAt,
  refetchThreat,
}: {
  threatId: string;
  createdAt: string;
  refetchThreat: () => void;
}) {
  // Query: check if user has liked this threat
  const {
    data: likeStatus,
    isLoading: likeLoading,
    isError: likeError,
    refetch: refetchLikeStatus,
  } = useQuery({
    queryKey: ["threat-like-status", threatId],
    queryFn: async () => {
      const res = await axios.get(
        `/api/digital-threats/read-like-status/${threatId}`
      );
      return res.data.liked as boolean;
    },
    enabled: !!threatId,
  });

  // Mutation: like (upvote)
  const {
    mutate: likeMutate,
    isPending: likeMutating,
    isError: likeMutateError,
    error: likeMutateErrorObj,
  } = useMutation({
    mutationFn: async () => {
      await axios.post(`/api/digital-threats/upvote-threats/${threatId}`, {
        createdAt,
      });
    },
    onSuccess: () => {
      refetchThreat();
      refetchLikeStatus();
    },
  });

  // Mutation: unlike (downvote)
  const {
    mutate: unlikeMutate,
    isPending: unlikeMutating,
    isError: unlikeMutateError,
    error: unlikeMutateErrorObj,
  } = useMutation({
    mutationFn: async () => {
      await axios.delete(`/api/digital-threats/upvote-threats/${threatId}`, {
        data: { createdAt },
      });
    },
    onSuccess: () => {
      refetchThreat();
      refetchLikeStatus();
    },
  });

  return {
    liked: !!likeStatus,
    likeLoading: likeLoading || likeMutating || unlikeMutating,
    likeError: likeError || likeMutateError || unlikeMutateError,
    handleLike: useCallback(() => likeMutate(), [likeMutate]),
    handleUnlike: useCallback(() => unlikeMutate(), [unlikeMutate]),
  };
}
