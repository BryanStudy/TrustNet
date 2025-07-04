"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import axios from "@/utils/axios";
import { createScamReportSchema } from "@/schema/scam-reports";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import ReportsImageUploader from "@/components/reports-image-uploader";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const schema = createScamReportSchema;
type FormData = z.infer<typeof schema>;

export default function NewScamReportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [imageFileName, setImageFileName] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    watch,
    control,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      anonymized: false,
      image: "",
    },
  });

  // Watch image for validation
  const image = watch("image");

  const onSubmit = async (data: FormData) => {
    try {
      await axios.post("/api/scam-reports/create-report", data);
      toast.success("Scam report posted successfully!");
      queryClient.invalidateQueries({ queryKey: ["my-scam-reports"] });
      queryClient.invalidateQueries({
        queryKey: ["scam-reports-with-user-detail"],
      });
      router.push("/scam-reports/my-reports");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to post scam report.");
    }
  };

  return (
    <div className="flex flex-col max-w-4xl mx-auto">
      <h1 className="text-4xl font-sans-bold mt-10 mb-8">New Posts</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
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
            Post
          </Button>
        </div>
      </form>
    </div>
  );
}
