"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ARTICLE_CATEGORIES } from "@/config/articles";

interface ArticlesSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  className?: string;
}

export function ArticlesSearchBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  className,
}: ArticlesSearchBarProps) {
  return (
    <div className={cn("flex flex-col md:flex-row gap-4", className)}>
      <div className="flex-1">
        <Input
          placeholder="Search by title or content..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full font-mono bg-white py-6"
        />
      </div>
      <div className="w-full md:w-[200px]">
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full font-mono bg-white py-6">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {ARTICLE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
} 