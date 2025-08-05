"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { FiEdit } from "react-icons/fi";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import axios from "@/utils/axios";
import { createDigitalThreatSchema } from "@/schema/digital-threats";
import { AxiosError } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import SubscriptionModal from "./subscription-modal";

type DigitalThreatForm = z.infer<typeof createDigitalThreatSchema>;

interface DigitalThreatsModalProps {
  onRefetch?: () => void;
}

export default function DigitalThreatsModal({
  onRefetch,
}: DigitalThreatsModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [createdThreatArtifact, setCreatedThreatArtifact] = useState("");
  const queryClient = useQueryClient();
  const form = useForm<DigitalThreatForm>({
    resolver: zodResolver(createDigitalThreatSchema),
    defaultValues: {
      artifact: "",
      type: "url",
      description: "",
    },
  });

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
  };

  const onSubmit = async (data: DigitalThreatForm) => {
    setLoading(true);
    try {
      const response = await axios.post("/digital-threats", data);
      if (response.status === 200) {
        toast.success("Threat created successfully");
        setLoading(false);
        setOpen(false);
        form.reset();

        // Store threat artifact for subscription modal
        setCreatedThreatArtifact(data.artifact);

        // Check subscription status and show modal if needed
        checkAndShowSubscriptionModal();

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["digital-threat"] });
        queryClient.invalidateQueries({ queryKey: ["digital-threats"] });
        queryClient.invalidateQueries({ queryKey: ["my-digital-threats"] });
        if (onRefetch) onRefetch();
      }
    } catch (error) {
      setLoading(false);
      if (error instanceof AxiosError && error.response) {
        const status = error.response.status;
        const apiError = error.response.data?.error || "Unknown error";
        if (status === 403 && apiError.includes("already exists")) {
          toast.error("This artifact already exists. Please submit a new one.");
          form.setError("artifact", {
            message: "This artifact already exists.",
          });
        } else {
          toast.error(apiError);
        }
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    }
  };

  const checkAndShowSubscriptionModal = async () => {
    try {
      const response = await axios.get("/notifications/status");
      const { subscribed } = response.data;

      // Only show subscription modal if user is not already subscribed
      if (!subscribed) {
        setShowSubscriptionModal(true);
      }
    } catch (error) {
      console.error("Error checking subscription status:", error);
      // If error checking status, show modal anyway (better to ask than miss)
      setShowSubscriptionModal(true);
    }
  };

  const handleSubscriptionComplete = () => {
    setShowSubscriptionModal(false);
    // Navigation happens automatically since the threat creation was successful
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setOpen(true)}
              className="bg-[var(--c-violet)] font-mono hover:bg-[var(--c-violet)]/80"
            >
              <FiEdit />
              New Threat
            </Button>
          </div>
        </DialogTrigger>
        <DialogContent className="p-8 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans-bold text-2xl mb-2">
              Create Threats
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4 mt-2"
            >
              <FormField
                control={form.control}
                name="artifact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono-bold text-base">
                      Artifact
                    </FormLabel>
                    <FormControl>
                      <input
                        type="text"
                        placeholder="http: example.com"
                        className="w-full px-3 py-2 border rounded-md font-mono text-base bg-transparent focus:outline-none focus:ring-2 focus:ring-[--c-violet]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono-bold text-base">
                      Type
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger className="w-full font-mono">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="font-mono">
                          <SelectItem value="url">url</SelectItem>
                          <SelectItem value="email">email</SelectItem>
                          <SelectItem value="phone">phone</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono-bold text-base">
                      Description
                    </FormLabel>
                    <FormControl>
                      <textarea
                        placeholder="Please write a brief summary of this digital threat"
                        className="w-full px-3 py-2 border rounded-md font-mono text-base bg-transparent min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-[--c-violet]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full mt-2 py-2 rounded-md font-mono text-lg bg-[var(--c-violet)] text-[var(--c-white)] transition-all flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-[var(--c-violet)]/80"
                disabled={loading}
              >
                {loading ? (
                  <span className="loader border-2 border-[var(--c-white)] border-t-transparent rounded-full w-5 h-5 animate-spin" />
                ) : (
                  "Submit"
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Subscription Modal */}
      <SubscriptionModal
        open={showSubscriptionModal}
        onOpenChange={setShowSubscriptionModal}
        threatArtifact={createdThreatArtifact}
        onComplete={handleSubscriptionComplete}
      />
    </>
  );
}
