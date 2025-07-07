"use client";

import React, { useState, useMemo } from "react";
import { useDigitalThreats } from "@/hooks/useDigitalThreats";
import { DigitalThreatsSearchBar } from "@/components/digital-threats/digital-threats-search-bar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FaLink, FaPhoneAlt } from "react-icons/fa";
import { IoMail } from "react-icons/io5";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const typeIconMap = {
  url: <FaLink className="text-[var(--c-violet)]" size={32} />,
  email: <IoMail className="text-[var(--c-violet)]" size={32} />,
  phone: <FaPhoneAlt className="text-[var(--c-violet)]" size={32} />,
};

function getRelativeTime(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const sortOptions = [
  { label: "Latest", value: "latest" },
  { label: "Oldest", value: "oldest" },
  { label: "Most Likes", value: "likes" },
];

export default function DigitalThreatsDirectoryPage() {
  const router = useRouter();
  const { digitalThreats, loading, isError } = useDigitalThreats();

  // Filter/search state
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("latest");

  // Filtering logic
  const filteredThreats = useMemo(() => {
    let filtered = digitalThreats.filter((threat) => {
      const matchesSearch =
        search === "" ||
        threat.artifact.toLowerCase().includes(search.toLowerCase()) ||
        threat.description.toLowerCase().includes(search.toLowerCase());
      const matchesType = type === "all" || type === "" || threat.type === type;
      const matchesStatus =
        status === "all" ||
        status === "" ||
        (status === "verified"
          ? threat.status === "verified"
          : status === "unverified"
          ? threat.status === "unverified"
          : true);
      return matchesSearch && matchesType && matchesStatus;
    });
    // Sorting
    if (sortBy === "latest") {
      filtered = filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (sortBy === "oldest") {
      filtered = filtered.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } else if (sortBy === "likes") {
      filtered = filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    return filtered;
  }, [digitalThreats, search, type, status, sortBy]);

  return (
    <div className="flex flex-col max-w-7xl mx-auto">
      <h1 className="text-4xl font-sans-bold mt-10">
        Digital Threats Directory
      </h1>
      <DigitalThreatsSearchBar
        search={search}
        onSearchChange={setSearch}
        type={type}
        onTypeChange={setType}
        status={status}
        onStatusChange={setStatus}
        className="mt-10"
      />
      <div className="flex justify-between items-center my-8">
        <div className="font-mono text-md flex items-center gap-2">
          Showing{" "}
          <p className="font-mono-bold text-[var(--c-violet)]">
            {filteredThreats.length}
          </p>{" "}
          Result{filteredThreats.length !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-md text-gray-500">Sort by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[150px] border-[var(--c-mauve)] rounded-md font-mono text-base bg-[var(--c-white)] py-2 px-3">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="font-mono text-base">
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-6 max-h-[70vh] overflow-y-auto pb-8">
        {loading ? (
          <div className="text-center font-mono text-lg py-20">Loading...</div>
        ) : isError ? (
          <div className="text-center font-mono text-lg text-red-500 py-20">
            Error loading digital threats.
          </div>
        ) : filteredThreats.length === 0 ? (
          <div className="text-center font-mono text-lg py-20">
            No Digital Threats
          </div>
        ) : (
          filteredThreats.map((threat) => (
            <Card
              key={threat.threatId + threat.createdAt}
              className="flex items-center gap-6 px-8 py-6 bg-[var(--c-white)] rounded-2xl border border-transparent hover:border-[var(--c-violet)] transition-colors cursor-pointer shadow-sm"
              onClick={() => {
                const params = new URLSearchParams({
                  threatId: threat.threatId,
                  createdAt: encodeURIComponent(threat.createdAt),
                });
                router.push(`/digital-threats/details?${params.toString()}`);
              }}
            >
              <div className="flex items-center gap-6 justify-between w-full">
                <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 bg-[var(--c-mauve)] rounded-xl">
                  {typeIconMap[threat.type]}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="font-mono-bold text-2xl text-[var(--c-coal)] break-all">
                    {threat.artifact}
                  </div>
                  <div className="font-mono text-md text-gray-500 mt-1">
                    {threat.likes} Like{threat.likes === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 ml-auto">
                  <Badge
                    variant={
                      threat.status === "verified" ? "default" : "secondary"
                    }
                    className={`font-mono ${
                      threat.status === "verified"
                        ? "bg-[var(--c-green)] text-white"
                        : "bg-[var(--c-mauve)] text-[var(--c-violet)]"
                    }`}
                  >
                    {threat.status === "verified" ? "Verified" : "Unverified"}
                  </Badge>
                  <span className="font-mono text-sm text-gray-400 mt-2">
                    {getRelativeTime(threat.createdAt)}
                  </span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
