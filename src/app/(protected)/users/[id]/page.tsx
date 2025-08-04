"use client";

import { Spinner } from "@/components/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserDeleteDialog } from "@/components/users/user-delete-dialog";
import {
  useDeleteUser,
  useUpdateUser,
  useUser,
  useUserById,
} from "@/hooks/useUser";
import axios from "@/utils/axios";
import { constructFileUrl } from "@/utils/fileUtils";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ImageIcon,
  LogOut,
  Mail,
  Pencil,
  Save,
  Shield,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

  if (diffInHours < 24) {
    const hours = Math.floor(diffInHours);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  } else if (diffInHours < 168) {
    const days = Math.floor(diffInHours / 24);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export default function UserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : undefined;
  const { user, loading, isError, error, refetch } = useUserById(userId);
  const { userInfo: currentUser } = useUser(); // Get current logged-in user
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});
  const { mutateAsync: updateUser, isPending: updating } = useUpdateUser();
  const { mutateAsync: deleteUser, isPending: deleting } = useDeleteUser();
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if the current user is viewing their own profile
  const isOwnProfile = currentUser?.userId === userId;

  React.useEffect(() => {
    if (user) setForm(user);
  }, [user]);

  if (loading)
    return (
      <div className="p-8 text-center font-mono text-lg">
        <Spinner size="medium" color="black" />
      </div>
    );
  if (isError || !user)
    return (
      <div className="p-8 text-center text-red-500 font-mono text-lg">
        Error loading user.
      </div>
    );

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : "?";

  const handleEdit = () => setEditMode(true);
  const handleCancel = () => {
    setEditMode(false);
    setForm(user);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRoleChange = (value: string) => {
    setForm({ ...form, role: value });
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
          folderPath: "profile-pictures",
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
      setForm({ ...form, picture: fileName });
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
    if (!form.picture) return;
    try {
      await fetch("/api/s3", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: form.picture,
          folderPath: "profile-pictures",
        }),
      });
      setForm({ ...form, picture: "" });
      toast.success("Image removed successfully");
    } catch (err) {
      toast.error("Failed to remove image");
    }
  }

  const handleSave = async () => {
    if (!userId) return;
    try {
      await updateUser({ userId, data: form });
      toast.success("User updated successfully");
      await refetch();
      setEditMode(false);
    } catch (err: any) {
      let apiError =
        err?.response?.data?.error || err?.message || "Failed to update user";
      if (Array.isArray(apiError)) {
        apiError = apiError.map((e: any) => e.message || String(e)).join(" | ");
      } else if (typeof apiError === "object" && apiError.errors) {
        apiError = apiError.errors.map((e: any) => e.message).join(" | ");
      }
      toast.error(apiError);
    }
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!userId) return;

    setShowDeleteDialog(false);

    try {
      await deleteUser(userId);
      toast.success("User deleted successfully");
      router.push("/users");
    } catch (err: any) {
      let apiError =
        err?.response?.data?.error || err?.message || "Failed to delete user";
      toast.error(apiError);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post("/logout");
      queryClient.clear(); // clear query cache when user logs out
      router.push("/");
      toast.success("Logged out successfully");
    } catch (err: any) {
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-md mt-10 relative">
      {/* Logout Button - Top left corner for own profile */}
      {isOwnProfile && !editMode && (
        <div className="absolute top-4 left-4">
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="flex cursor-pointer items-center gap-1 text-red-600 border border-red-300 bg-white hover:bg-red-100 hover:border-red-400"
          >
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      )}

      {/* Profile Picture */}
      <div className="relative w-32 h-32 mx-auto mb-6">
        <Avatar className="w-full h-full rounded-2xl">
          {form.picture ? (
            <AvatarImage
              src={constructFileUrl(form.picture, "profile-pictures")}
              alt={`${form.firstName} ${form.lastName}`}
              className="object-cover w-full h-full rounded-2xl"
            />
          ) : null}
          <AvatarFallback className="bg-[var(--c-mauve)] text-[var(--c-violet)] text-2xl font-mono rounded-2xl">
            {initials}
          </AvatarFallback>
        </Avatar>

        {editMode && (
          <div className="absolute -bottom-2 -right-2 flex gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              ref={fileInputRef}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="bg-white shadow-md cursor-pointer"
            >
              {imageUploading ? (
                <Spinner size="small" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
            </Button>
            {form.picture && (
              <Button
                variant="destructive"
                size="sm"
                onClick={removeImage}
                className="shadow-md cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* User Info Header */}
      <div className="text-center mb-6">
        {editMode ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-mono-bold text-gray-700 mb-1 text-left">
                  First Name
                </label>
                <input
                  className="font-sans-bold text-xl w-full border rounded-md px-3 py-2 text-center"
                  name="firstName"
                  placeholder="First Name"
                  value={form.firstName || ""}
                  onChange={handleChange}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-mono-bold text-gray-700 mb-1 text-left">
                  Last Name
                </label>
                <input
                  className="font-sans-bold text-xl w-full border rounded-md px-3 py-2 text-center"
                  name="lastName"
                  placeholder="Last Name"
                  value={form.lastName || ""}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-mono-bold text-gray-700 mb-1 text-left">
                Email Address
              </label>
              <input
                className="font-mono text-base w-full border rounded-md px-3 py-2 text-center"
                name="email"
                type="email"
                placeholder="Email"
                value={form.email || ""}
                onChange={handleChange}
              />
            </div>
            {/* Only show the user role input if the current user is an admin*/}
            {!(currentUser?.role === "customer") && (
              <div>
                <label className="block text-sm font-mono-bold text-gray-700 mb-1 text-left">
                  User Role
                </label>
                <Select value={form.role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
          <>
            <h1 className="font-sans-bold text-2xl mb-2">
              {user.firstName} {user.lastName}
            </h1>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="font-mono text-gray-600">{user.email}</span>
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-gray-400" />
              <Badge
                variant="secondary"
                className={`font-mono ${
                  user.role === "admin"
                    ? "bg-[var(--c-mauve)] text-[var(--c-violet)]"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {user.role}
              </Badge>
            </div>
          </>
        )}
      </div>

      {/* User Details */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-3 text-gray-500 font-mono text-sm">
          <Calendar className="w-4 h-4" />
          <span>
            Created:{" "}
            {user.createdAt
              ? new Date(user.createdAt).toLocaleDateString()
              : ""}
          </span>
        </div>
        {user.updatedAt && (
          <div className="flex items-center gap-3 text-gray-500 font-mono text-sm">
            <UserIcon className="w-4 h-4" />
            <span>Updated: {formatDate(user.updatedAt)}</span>
          </div>
        )}
      </div>

      {/* Edit/Delete Buttons */}
      <div className="flex gap-2 justify-center">
        {editMode ? (
          <>
            <Button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-600/80 text-white flex items-center gap-1 cursor-pointer"
              disabled={updating || imageUploading}
            >
              <Save className="w-4 h-4" /> {updating ? "Saving..." : "Save"}
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex items-center gap-1 cursor-pointer"
              disabled={updating || imageUploading}
            >
              <X className="w-4 h-4" /> Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={handleEdit}
              className="bg-[var(--c-violet)] hover:bg-[var(--c-violet)]/80 text-white flex items-center gap-1 cursor-pointer"
            >
              <Pencil className="w-4 h-4" /> Edit
            </Button>
            {!isOwnProfile && (
              <Button
                onClick={handleDelete}
                variant="destructive"
                className="flex items-center gap-1 cursor-pointer hover:bg-red-500 hover:text-white"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <UserDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        user={user}
        onConfirm={confirmDelete}
        isDeleting={deleting}
      />
    </div>
  );
}
