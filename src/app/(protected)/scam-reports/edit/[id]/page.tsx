"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "@/utils/axios";
import { createScamReportSchema } from "@/schema/scam-reports";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import ReportsImageUploader from "@/components/reports-image-uploader";
import { toast } from "sonner";
import { useScamReport } from "@/hooks/useScamReports";
import { constructFileUrl } from "@/utils/fileUtils";
import React from "react";
import { useQueryClient } from "@tanstack/react-query";

const schema = createScamReportSchema;
type FormData = z.infer<typeof schema> & { createdAt: string };

export default function EditScamReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdAt = searchParams.get("createdAt") || "";
  const { report, loading, isError } = useScamReport(id, createdAt);
  const [imageFileName, setImageFileName] = useState("");
  const [initialImageUrl, setInitialImageUrl] = useState<string | undefined>(
    undefined
  );
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    watch,
    control,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema.extend({ createdAt: z.string() })),
    defaultValues: {
      title: "",
      description: "",
      anonymized: false,
      image: "",
      createdAt: createdAt,
    },
  });

  // Prefill form when report is loaded
  useEffect(() => {
    if (report) {
      reset({
        title: report.title,
        description: report.description,
        anonymized: report.anonymized,
        image: report.image,
        createdAt: report.createdAt,
      });
      setImageFileName(report.image);
      setInitialImageUrl(
        report.image
          ? constructFileUrl(report.image, "scam-reports")
          : undefined
      );
    }
  }, [report, reset]);

  // Watch image for validation
  const image = watch("image");

  const onSubmit = async (data: FormData) => {
    try {
      await axios.put(`/api/scam-reports/update-report/${id}`, data);
      toast.success("Scam report updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["my-scam-reports"] });
      queryClient.invalidateQueries({
        queryKey: ["scam-report", id, createdAt],
      });
      queryClient.invalidateQueries({
        queryKey: ["scam-reports-with-user-detail"],
      });
      queryClient.invalidateQueries({
        queryKey: ["scam-report-with-user-detail", id, createdAt],
      });
      queryClient.invalidateQueries({ queryKey: ["searched-scam-reports"] });
      router.push("/scam-reports/my-reports");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update scam report.");
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 font-mono text-lg">Loading...</div>
    );
  }
  if (isError || !report) {
    return (
      <div className="text-center py-20 font-mono text-lg text-red-500">
        Failed to load report.
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-4xl mx-auto">
      <h1 className="text-4xl font-sans-bold mt-10 mb-8">Edit Report</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <input type="hidden" {...register("createdAt")} />
        <div>
          <label className="block text-lg font-sans-bold mb-2">Title</label>
          <Input
            {...register("title")}
            placeholder="Give your post a compelling title"
            className={`w-full bg-white border-gray-300 focus-visible:border-[var(--c-violet)] focus-visible:ring-2 focus-visible:ring-[var(--c-violet)] ${
              errors.title ? "border-red-500" : ""
            }`}
            disabled={isSubmitting}
          />
          {errors.title && (
            <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
          )}
        </div>
        <div>
          <label className="block text-lg font-sans-bold mb-2">
            Description
          </label>
          <Textarea
            {...register("description")}
            placeholder="Share your experience in detail here"
            className={`w-full bg-white border-gray-300 focus-visible:border-[var(--c-violet)] focus-visible:ring-2 focus-visible:ring-[var(--c-violet)] ${
              errors.description ? "border-red-500" : ""
            }`}
            rows={5}
            disabled={isSubmitting}
          />
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">
              {errors.description.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-lg font-sans-bold mb-2">
            Screenshot / Image
          </label>
          <ReportsImageUploader
            onUploadComplete={(fileName) => {
              setImageFileName(fileName);
              setValue("image", fileName, { shouldValidate: true });
            }}
            folderPath="scam-reports"
            sizeLimit={1024 * 1024 * 5}
            // Show the current image if it exists
            key={initialImageUrl || "uploader"}
            initialImageUrl={initialImageUrl}
            initialFileName={report.image}
          />
          {errors.image && (
            <p className="text-red-500 text-sm mt-1">{errors.image.message}</p>
          )}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Controller
            name="anonymized"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="anonymized"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isSubmitting}
              />
            )}
          />
          <label htmlFor="anonymized" className="text-md font-sans">
            I want to remain anonymous
          </label>
        </div>
        <div className="flex justify-end mt-8">
          <Button
            type="submit"
            className="bg-[var(--c-violet)] text-white px-10 py-3 text-lg rounded-lg hover:bg-[var(--c-violet)]/90 font-mono-bold"
            disabled={isSubmitting}
          >
            Update
          </Button>
        </div>
      </form>
    </div>
  );
}
