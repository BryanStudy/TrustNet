"use client";

import { useCallback, useState } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Loader2, Trash2, User } from "lucide-react";

type UploadFile = {
  id: string;
  file: File;
  uploading: boolean;
  progress: number;
  fileName?: string;
  isDeleting: boolean;
  error: boolean;
  objectUrl?: string;
};

interface ProfilePictureUploaderProps {
  folderPath?: string;
  sizeLimit?: number;
  onUploadComplete?: (fileName: string) => void;
}

export default function ProfilePictureUploader({
  folderPath = "profile-pictures",
  sizeLimit = 1024 * 1024 * 5,
  onUploadComplete,
}: ProfilePictureUploaderProps) {
  const [file, setFile] = useState<UploadFile | null>(null);

  async function removeFile() {
    if (!file) return;

    try {
      if (file.objectUrl) {
        URL.revokeObjectURL(file.objectUrl);
      }

      setFile((prev) => (prev ? { ...prev, isDeleting: true } : null));

      const deleteFileResponse = await fetch("/api/s3", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: file.fileName,
          folderPath: folderPath,
        }),
      });

      if (!deleteFileResponse.ok) {
        console.error(
          "Failed to delete file:",
          await deleteFileResponse.text()
        );
        toast.error("Failed to delete file");
        setFile((prev) =>
          prev ? { ...prev, isDeleting: false, error: true } : null
        );
        return;
      }

      toast.success("Profile picture removed");
      setFile(null);
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
      setFile((prev) =>
        prev ? { ...prev, isDeleting: false, error: true } : null
      );
    }
  }

  async function uploadFile(uploadFile: File) {
    setFile((prev) => (prev ? { ...prev, uploading: true } : null));

    try {
      const presignedUrlResponse = await fetch("/api/s3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: uploadFile.name,
          contentType: uploadFile.type,
          size: uploadFile.size,
          folderPath: folderPath,
        }),
      });

      if (!presignedUrlResponse.ok) {
        console.error(
          "Failed to get presigned URL:",
          await presignedUrlResponse.text()
        );
        toast.error("Failed to get presigned URL");
        setFile((prev) =>
          prev ? { ...prev, uploading: false, progress: 0, error: true } : null
        );
        return;
      }

      const { presignedUrl, fileName } = await presignedUrlResponse.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentageCompleted = (event.loaded / event.total) * 100;
            setFile((prev) =>
              prev
                ? {
                    ...prev,
                    progress: Math.round(percentageCompleted),
                    fileName: fileName,
                  }
                : null
            );
          }
        };
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) {
            setFile((prev) =>
              prev
                ? {
                    ...prev,
                    progress: 100,
                    uploading: false,
                    error: false,
                  }
                : null
            );
            toast.success("Profile picture uploaded successfully");
            if (onUploadComplete && fileName) {
              onUploadComplete(fileName);
            }
            resolve();
          } else {
            reject(new Error(`Failed to upload file: ${xhr.status}`));
          }
        };
        xhr.onerror = () => {
          reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", uploadFile.type);
        xhr.send(uploadFile);
      });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      toast.error("Failed to upload profile picture");
      setFile((prev) =>
        prev ? { ...prev, uploading: false, progress: 0, error: true } : null
      );
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const newFile = acceptedFiles[0]; // Only take the first file
      setFile({
        id: uuidv4(),
        file: newFile,
        uploading: false,
        progress: 0,
        isDeleting: false,
        error: false,
        objectUrl: URL.createObjectURL(newFile),
      });
      uploadFile(newFile);
    }
  }, []);

  const onDropRejected = useCallback(
    (fileRejections: FileRejection[]) => {
      if (fileRejections.length === 0) return;

      const errorMessages = {
        "too-many-files": "You can only upload one profile picture",
        "file-too-large": `File size cannot exceed ${Math.round(
          sizeLimit / (1024 * 1024)
        )}MB`,
        "file-invalid-type": "Only images are allowed",
      };

      const firstError = fileRejections[0].errors[0];
      const errorMessage =
        errorMessages[firstError.code as keyof typeof errorMessages];

      if (errorMessage) {
        toast.error(errorMessage);
      }
    },
    [sizeLimit]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    maxFiles: 1,
    maxSize: sizeLimit,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg"],
    },
  });

  return (
    <div className="space-y-4">
      {!file ? (
        <Card
          {...getRootProps()}
          className={cn(
            "relative border transition-colors duration-200 ease-in-out w-full h-40 cursor-pointer",
            isDragActive
              ? "border-[var(--c-violet)] bg-[var(--c-violet)]/10"
              : "border-gray-300 hover:border-[var(--c-violet)]"
          )}
        >
          <CardContent className="flex flex-col items-center justify-center h-full w-full">
            <input {...getInputProps()} />
            {isDragActive ? (
              <p className="text-sm text-gray-600">
                Drop your profile picture here
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full gap-y-4">
                <User className="w-12 h-12 text-gray-400" />
                <p className="text-sm text-gray-600 text-center">
                  Drop your profile picture here, or click to select
                </p>
                <Button
                  className="bg-[var(--c-violet)] text-white hover:bg-[var(--c-violet)]/90"
                  type="button"
                >
                  Choose Picture
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200">
              <img
                src={file.objectUrl!}
                alt="Profile picture"
                className="w-full h-full object-cover"
              />
            </div>
            {file.uploading && !file.isDeleting && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <p className="text-white font-medium text-sm">
                  {file.progress}%
                </p>
              </div>
            )}
            {file.error && (
              <div className="absolute inset-0 bg-red-500/50 rounded-full flex items-center justify-center">
                <p className="text-white font-medium text-xs">Error</p>
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {file.file.name}
            </p>
            <p className="text-xs text-gray-500">
              {Math.round(file.file.size / 1024)} KB
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={removeFile}
            disabled={file.uploading || file.isDeleting}
          >
            {file.isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
