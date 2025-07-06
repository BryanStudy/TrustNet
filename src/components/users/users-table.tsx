import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserDeleteDialog } from "./user-delete-dialog";
import { constructFileUrl } from "@/utils/fileUtils";
import { cn } from "@/lib/utils";
import { useDeleteUser } from "@/hooks/useUser";
import { toast } from "sonner";

interface User {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  picture: string | null;
  createdAt: string;
}

interface UsersTableProps {
  users: User[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
}

export function UsersTable({ users, isLoading, isError, onRefetch }: UsersTableProps) {
  const router = useRouter();
  const { mutateAsync: deleteUser, isPending: deleting } = useDeleteUser();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleEdit = (userId: string) => {
    router.push(`/users/${userId}`);
  };

  const handleDelete = (user: User) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    setShowDeleteDialog(false);
    
    try {
      await deleteUser(userToDelete.userId);
      toast.success("User deleted successfully");
      onRefetch(); // Refresh the users list
    } catch (err: any) {
      let apiError = err?.response?.data?.error || err?.message || "Failed to delete user";
      toast.error(apiError);
    } finally {
      setUserToDelete(null);
    }
  };

  return (
    <div className="w-full">
      <Table className="w-full border border-[var(--c-mauve)] rounded-none">
        <TableHeader className="bg-[var(--c-mauve)] text-center">
          <TableRow>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              User
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Email
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Role
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Created At
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-[var(--c-white)] text-center font-mono">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8">
                Loading...
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-red-500">
                Error loading users
              </TableCell>
            </TableRow>
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => {
              const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
              const formattedDate = new Date(user.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              });

              return (
                <TableRow
                  key={user.userId}
                  className="hover:bg-[var(--c-mauve)]/40 transition-colors"
                >
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-3">
                      <Avatar className="h-8 w-8 rounded-lg">
                        {user.picture ? (
                          <AvatarImage
                            src={constructFileUrl(user.picture, "profile-pictures")}
                            alt={`${user.firstName} ${user.lastName}`}
                          />
                        ) : null}
                        <AvatarFallback className="rounded-lg bg-[var(--c-mauve)] text-[var(--c-violet)]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-mono-bold text-[var(--c-coal)]">
                        {user.firstName} {user.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{user.email}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "font-mono",
                        user.role === "admin" ? "bg-[var(--c-mauve)] text-[var(--c-violet)]" : "bg-gray-100"
                      )}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{formattedDate}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label="Edit"
                        className="bg-[var(--c-mauve)] text-[var(--c-violet)] cursor-pointer hover:bg-[var(--c-violet)] hover:text-white"
                        onClick={() => handleEdit(user.userId)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        aria-label="Delete"
                        className="cursor-pointer bg-red-500 hover:text-white"
                        onClick={() => handleDelete(user)}
                        disabled={deleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <UserDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        user={userToDelete}
        onConfirm={confirmDelete}
        isDeleting={deleting}
      />
    </div>
  );
} 