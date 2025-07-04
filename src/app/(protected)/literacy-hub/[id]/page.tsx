"use client";

import React, { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useArticle } from "@/hooks/useArticles";
import { useUpdateArticle } from "@/hooks/useArticles";
import { useDeleteArticle } from "@/hooks/useArticles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { constructFileUrl } from "@/utils/fileUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Save, X, Calendar, User as UserIcon, Clock, Tag, ImageIcon, Eye } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/spinner";
import { v4 as uuidv4 } from "uuid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ARTICLE_CATEGORIES } from "@/config/articles";

const categoryColors = {
  "Email Security": "bg-red-100 text-red-800",
  "Privacy": "bg-blue-100 text-blue-800",
  "Authentication": "bg-green-100 text-green-800",
  "Digital Literacy": "bg-purple-100 text-purple-800",
  "Online Shopping": "bg-orange-100 text-orange-800",
  "Media Literacy": "bg-indigo-100 text-indigo-800"
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

  if (diffInHours < 24) {
    // If less than 24 hours, show "X hours ago"
    const hours = Math.floor(diffInHours);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffInHours < 168) {
    // If less than 7 days, show "X days ago"
    const days = Math.floor(diffInHours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else {
    // Otherwise show the date
    return date.toLocaleDateString();
  }
}

export default function ArticleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const articleId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const { article, isSuccess, isError, error, refetch } = useArticle(articleId);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});
  const { updateArticle, isLoading: updating } = useUpdateArticle();
  const { deleteArticle, isLoading: deleting } = useDeleteArticle();
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (article) setForm(article);
  }, [article]);

  if (!isSuccess) return <div className="p-8 text-center font-mono text-lg"><Spinner size="medium" color="black" /></div>;
  if (isError || !article) return <div className="p-8 text-center text-red-500 font-mono text-lg">Error loading article.</div>;

  const initials = article.authorName
    ? article.authorName.split(" ").map((n: string) => n[0]).join("").toUpperCase()
    : "AU";

  const handleEdit = () => setEditMode(true);
  const handleCancel = () => {
    setEditMode(false);
    setForm(article);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleCategoryChange = (value: string) => {
    setForm({ ...form, category: value });
  };

  // Image upload logic
  async function uploadImage(file: File) {
    setImageUploading(true);
    setImageError(null);
    try {
      const presignedUrlResponse = await fetch("/api/s3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: uuidv4() + "-" + file.name,
          contentType: file.type,
          size: file.size,
          folderPath: "article-images",
        }),
      });
      if (!presignedUrlResponse.ok) {
        setImageUploading(false);
        setImageError("Failed to get presigned URL");
        toast.error("Failed to get presigned URL");
        return;
      }
      const { presignedUrl, fileName } = await presignedUrlResponse.json();
      await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      setImageUploading(false);
      setForm({ ...form, coverImage: fileName });
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

  async function removeImage() {
    if (!form.coverImage) return;
    try {
      await fetch("/api/s3", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: form.coverImage,
          folderPath: "article-images",
        }),
      });
      setForm({ ...form, coverImage: "" });
      toast.success("Image removed successfully");
    } catch (err) {
      toast.error("Failed to remove image");
    }
  }

  const handleSave = async () => {
    if (!articleId) return;
    try {
      await updateArticle({ articleId, data: form });
      toast.success("Article updated successfully");
      await refetch();
      setEditMode(false);
    } catch (err: any) {
      let apiError = err?.response?.data?.error || err?.message || "Failed to update article";
      // If it's a Zod error array, join the messages
      if (Array.isArray(apiError)) {
        apiError = apiError.map((e: any) => e.message || String(e)).join(" | ");
      } else if (typeof apiError === "object" && apiError.errors) {
        apiError = apiError.errors.map((e: any) => e.message).join(" | ");
      }
      toast.error(apiError);
    }
  };

  const handleDelete = async () => {
    if (!articleId) return;
    try {
      // Delete the cover image first if it exists
      if (article.coverImage) {
        await fetch("/api/s3", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: article.coverImage,
            folderPath: "article-images",
          }),
        });
      }
      await deleteArticle(articleId);
      toast.success("Article deleted successfully");
      router.push("/literacy-hub");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to delete article");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-md mt-10">
      {/* Cover Image */}
      <div className="relative w-full aspect-[16/9] bg-gray-100 rounded-2xl overflow-hidden mb-6">
        {form.coverImage ? (
          <>
            <img
              src={constructFileUrl(form.coverImage, "article-images")}
              alt="Cover"
              className="object-cover w-full h-full"
              style={{ minHeight: 0, minWidth: 0, display: 'block' }}
            />
            {editMode && (
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={removeImage}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </>
        ) : editMode ? (
          <div className="w-full h-full flex items-center justify-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              ref={fileInputRef}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="flex items-center gap-2"
            >
              {imageUploading ? (
                <Spinner size="small" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
              {imageUploading ? "Uploading..." : "Upload Cover Image"}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Author Info */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar className="w-12 h-12 rounded-lg">
          {article.authorPicture ? (
            <AvatarImage
              src={constructFileUrl(article.authorPicture, "profile-pictures")}
              alt={article.authorName}
            />
          ) : null}
          <AvatarFallback className="bg-[var(--c-mauve)] text-[var(--c-violet)] text-lg font-mono">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-sans-bold text-lg flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-gray-400" /> {article.authorName || "Author"}
          </span>
          <div className="flex items-center gap-3 text-gray-500 font-mono text-sm">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {article.createdAt ? new Date(article.createdAt).toLocaleString() : ""}
            </span>
            <span className="text-gray-400">•</span>
            <span className="font-mono text-gray-500" title={new Date(article.updatedAt).toLocaleString()}>
              Updated {formatDate(article.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Article Info */}
      <div className="flex items-center gap-3 mb-2">
        {editMode ? (
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1">
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {ARTICLE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <input
                type="number"
                name="readTime"
                min="1"
                value={form.readTime || ""}
                onChange={handleChange}
                className="w-20 px-2 py-1 border rounded-md font-mono text-sm"
                placeholder="5"
              />
              <span className="font-mono text-sm text-gray-500">min</span>
            </div>
          </div>
        ) : (
          <>
            <Badge className={`font-mono text-xs px-3 py-1 rounded-full ${categoryColors[article.category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-800'}`}>
              <Tag className="w-4 h-4 mr-1 inline" /> {article.category}
            </Badge>
            <span className="font-mono text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-4 h-4" /> {article.readTime} min read
            </span>
          </>
        )}
      </div>

      {editMode ? (
        <input
          className="font-sans-bold text-2xl w-full border rounded-md px-2 py-1 mb-2"
          name="title"
          value={form.title || ""}
          onChange={handleChange}
        />
      ) : (
        <>
          <h1 className="font-sans-bold text-2xl mb-2">{article.title}</h1>
          <div className="flex items-center gap-2 mb-4 text-gray-500 font-mono text-sm">
            <Eye className="w-4 h-4" />
            <span>{article.viewCount || 0} {(article.viewCount === 1) ? "view" : "views"}</span>
          </div>
        </>
      )}

      {editMode ? (
        <textarea
          className="font-mono text-base w-full border rounded-md px-2 py-1"
          name="content"
          value={form.content || ""}
          onChange={handleChange}
          rows={6}
        />
      ) : (
        <p className="font-mono text-base text-gray-700 whitespace-pre-line">{article.content}</p>
      )}

      {/* Edit/Delete Buttons */}
      <div className="flex gap-2 mt-6">
        {editMode ? (
          <>
            <Button onClick={handleSave} className="bg-green-600 text-white flex items-center gap-1" disabled={updating || imageUploading}>
              <Save className="w-4 h-4" /> {updating ? "Saving..." : "Save"}
            </Button>
            <Button onClick={handleCancel} variant="outline" className="flex items-center gap-1" disabled={updating || imageUploading}>
              <X className="w-4 h-4" /> Cancel
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleEdit} className="bg-[var(--c-violet)] text-white flex items-center gap-1">
              <Pencil className="w-4 h-4" /> Edit
            </Button>
            <Button onClick={handleDelete} variant="destructive" className="flex items-center gap-1" disabled={deleting}>
              <Trash2 className="w-4 h-4" /> {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}