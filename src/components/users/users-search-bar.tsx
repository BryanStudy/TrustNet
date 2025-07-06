import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface UsersSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
  className?: string;
}

export function UsersSearchBar({
  search,
  onSearchChange,
  role,
  onRoleChange,
  className,
}: UsersSearchBarProps) {
  return (
    <div className={cn("flex gap-4", className)}>
      <Input
        placeholder="Search by name or email"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 bg-white p-6"
      />
      <Select value={role} onValueChange={onRoleChange}>
        <SelectTrigger className="w-full md:w-[180px] bg-white p-6">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="customer">Customer</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
} 