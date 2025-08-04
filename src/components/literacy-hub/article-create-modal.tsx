"use client";

import { useState, useRef } from "react";
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useCreateArticle } from "@/hooks/useArticles";
import { createArticleSchema } from "@/schema/articles";
import { PenSquare, Loader2, Trash2, Image as ImageIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { constructFileUrl } from "@/utils/fileUtils";
import { ARTICLE_CATEGORIES } from "@/config/articles";
import axios from "@/utils/axios";

const categories = ARTICLE_CATEGORIES;

type ArticleForm = z.infer<typeof createArticleSchema> & { coverImage?: string };

interface ArticleCreateModalProps {
  onRefetch?: () => void;
}

export default function ArticleCreateModal({ onRefetch }: ArticleCreateModalProps) {
  const [open, setOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ArticleForm>({
    resolver: zodResolver(createArticleSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      readTime: 5,
      coverImage: undefined,
    },
  });
  const { createArticle, isLoading, error, isSuccess, reset } = useCreateArticle();

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      form.reset();
      reset();
      setImageFile(null);
      setImageUrl(null);
      setImageError(null);
    }
  };

  const onSubmit = async (data: ArticleForm) => {
    try {
      const submitData = { ...data, coverImage: form.getValues("coverImage") };
      await createArticle(submitData);
      toast.success("Article created successfully");
      form.reset();
      if (onRefetch) onRefetch();
      setOpen(false);
    } catch (err: any) {
      const apiError = err?.response?.data?.error || err?.message || "Failed to create article";
      toast.error(apiError);
    }
  };

  // Image upload logic
  async function uploadImage(file: File) {
    setImageUploading(true);
    setImageError(null);
    try {
      const presignedUrlResponse = await axios.post("/s3", {
        fileName: uuidv4() + "-" + file.name,
        contentType: file.type,
        size: file.size,
        folderPath: "article-images",
      });

      if (presignedUrlResponse.status !== 200) {
        setImageError("Failed to get presigned URL");
        toast.error("Failed to get presigned URL");
        return null;
      }

      const { presignedUrl, fileName } = presignedUrlResponse.data;
      await axios.put(presignedUrl, file, {
        headers: { "Content-Type": file.type },
      });
      setImageUploading(false);
      setImageFile(file);
      setImageUrl(constructFileUrl(fileName, "article-images"));
      form.setValue("coverImage", fileName);
      toast.success("Image uploaded successfully");
    } catch (err) {
      setImageUploading(false);
      setImageError("Failed to upload image");
      toast.error("Failed to upload image");
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Only image files are allowed");
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image size must be under 5MB");
      toast.error("Image size must be under 5MB");
      return;
    }
    uploadImage(file);
  }

  function removeImage() {
    setImageFile(null);
    setImageUrl(null);
    form.setValue("coverImage", "");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          onClick={() => setOpen(true)}
          className="bg-[var(--c-violet)] font-mono hover:bg-[var(--c-violet)]/80 cursor-pointer"
        >
          <PenSquare size={18} />
          New Article
        </Button>
      </DialogTrigger>
      <DialogContent className="p-8 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans-bold text-2xl mb-2">
            Create Article
          </DialogTitle>
        </DialogHeader>
        <div className="mb-4">
          <label className="font-mono-bold text-base block mb-2">Cover Image</label>
          {imageUrl ? (
            <div className="relative w-full aspect-[16/9] mb-2 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
              <img src={imageUrl} alt="Cover" className="object-cover w-full h-full" style={{ minHeight: 0, minWidth: 0 }} />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2"
                onClick={removeImage}
                disabled={imageUploading}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              {imageUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg h-40 cursor-pointer bg-gray-50 relative">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                ref={fileInputRef}
                onChange={handleImageChange}
                disabled={imageUploading}
              />
              {imageUploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              ) : (
                <>
                  <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="font-mono text-gray-500">Click or drag to upload</span>
                </>
              )}
            </div>
          )}
          {imageError && <div className="text-red-500 text-xs mt-1">{imageError}</div>}
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4 mt-2"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono-bold text-base">
                    Title
                  </FormLabel>
                  <FormControl>
                    <input
                      type="text"
                      placeholder="Article title"
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
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono-bold text-base">
                    Category
                  </FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger className="w-full font-mono">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="font-mono">
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="readTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono-bold text-base">
                    Read Time (minutes)
                  </FormLabel>
                  <FormControl>
                    <input
                      type="number"
                      min={1}
                      placeholder="5"
                      className="w-full px-3 py-2 border rounded-md font-mono text-base bg-transparent focus:outline-none focus:ring-2 focus:ring-[--c-violet]"
                      {...field}
                      value={field.value || ""}
                      onChange={e => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono-bold text-base">
                    Content
                  </FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="Write your article content here..."
                      className="w-full px-3 py-2 border rounded-md font-mono text-base bg-transparent min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-[--c-violet]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full mt-2 py-2 rounded-md font-mono text-lg bg-[var(--c-violet)] text-[var(--c-white)] transition-all flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-[var(--c-violet)]/80 cursor-pointer"
              disabled={isLoading || imageUploading}
            >
              {isLoading ? (
                <span className="loader border-2 border-[var(--c-white)] border-t-transparent rounded-full w-5 h-5 animate-spin" />
              ) : (
                "Submit"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 