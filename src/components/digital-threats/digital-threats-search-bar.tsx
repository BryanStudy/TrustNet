import React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { IoSearchOutline } from "react-icons/io5";
import { TbCategory } from "react-icons/tb";
import { MdOutlineVerified } from "react-icons/md";

type SearchBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  className?: string;
};

export const DigitalThreatsSearchBar: React.FC<SearchBarProps> = ({
  search,
  onSearchChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
  className,
}) => (
  <div className={cn("flex gap-4 items-center w-full", className)}>
    <div className="relative flex-1">
      <IoSearchOutline className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500 pointer-events-none" />
      <Input
        className={cn(
          "pl-12 pr-4 py-6 border border-[var(--c-mauve)] rounded-none font-mono text-base bg-[var(--c-white)] w-full",
          "placeholder:font-mono placeholder:text-gray-600",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--c-violet)]"
        )}
        placeholder="Search emails, phone numbers or URLs"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
    <Select value={type} onValueChange={onTypeChange}>
      <SelectTrigger className="w-[120px] border-[var(--c-mauve)] rounded-none font-mono text-base bg-[var(--c-white)] py-6">
        <div className="flex items-center gap-2">
          <TbCategory className="text-gray-500" />
          <SelectValue placeholder="Type" />
        </div>
      </SelectTrigger>
      <SelectContent className="font-mono text-base">
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="url">url</SelectItem>
        <SelectItem value="email">email</SelectItem>
        <SelectItem value="phone">phone</SelectItem>
      </SelectContent>
    </Select>
    <Select value={status} onValueChange={onStatusChange}>
      <SelectTrigger className="w-[160px] border-[var(--c-mauve)] rounded-none font-mono text-base bg-[var(--c-white)] py-6">
        <div className="flex items-center gap-2">
          <MdOutlineVerified className="text-gray-500" />
          <SelectValue placeholder="Status" />
        </div>
      </SelectTrigger>
      <SelectContent className="font-mono text-base">
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="verified">Verified</SelectItem>
        <SelectItem value="unverified">Unverified</SelectItem>
      </SelectContent>
    </Select>
  </div>
);
