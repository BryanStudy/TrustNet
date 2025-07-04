"use client";

import React, { useState, useCallback } from "react";
import {
  useScamReportsWithUserDetail,
  useSearchedScamReports,
} from "@/hooks/useScamReports";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { Spinner } from "@/components/spinner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScamReportWithUserDetail } from "@/types/scam-reports";
import { FaUser } from "react-icons/fa";
import { IoSearchOutline } from "react-icons/io5";

// Search bar component
function ScamReportsSearchBar({
  search,
  setSearch,
  onSearch,
  loading,
}: {
  search: string;
  setSearch: (s: string) => void;
  onSearch: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex gap-4 items-center w-full mt-8">
      <div className="relative flex-1">
        <IoSearchOutline className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500 pointer-events-none" />
        <Input
          className={
            "pl-12 pr-4 py-6 rounded-md border border-[var(--c-mauve)] text-base bg-[var(--c-white)] w-full placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--c-violet)]"
          }
          placeholder="Search by Title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
          disabled={loading}
        />
      </div>
      <Button
        onClick={onSearch}
        className="px-8 py-6 text-sm font-sans-bold bg-[var(--c-violet)] text-white rounded-md hover:bg-[var(--c-violet)]/80 transition-colors"
        style={{ minWidth: 120 }}
        disabled={loading}
      >
        Search
      </Button>
    </div>
  );
}

// Card for a single scam report
function ScamReportCard({ report }: { report: ScamReportWithUserDetail }) {
  return (
    <Card className="flex flex-col h-full max-w-full justify-center py-2">
      <div className="flex flex-row items-center justify-between px-4 py-4">
        <div className="w-full flex-2/3 border-r-2 border-[var(--c-gray)]/20">
          <div className="flex flex-col">
            <CardHeader className="flex flex-row items-center gap-3 px-4 pt-2 pb-0">
              {report.reporterPicture && !report.anonymized && (
                <Avatar className="size-6">
                  <AvatarImage
                    src={report.reporterPicture}
                    alt={report.reporterName}
                  />
                </Avatar>
              )}
              {report.anonymized && (
                <FaUser className="text-[var(--c-violet)]" />
              )}
              <div className="flex flex-col flex-1">
                <span className="font-sans text-sm truncate">
                  {report.anonymized ? "Anonymous User" : report.reporterName}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(report.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-4 mt-4 pb-4 flex-1">
              <CardTitle className="text-lg font-sans-bold line-clamp-1">
                {report.title}
              </CardTitle>
              <CardDescription className="line-clamp-2 text-xs">
                {report.description}
              </CardDescription>
            </CardContent>
          </div>
        </div>
        <div className="w-full flex-1/3 px-4">
          {report.image && (
            <img
              src={report.image}
              alt="Report Image"
              className="w-full h-full object-cover rounded-lg"
              style={{ maxHeight: 160 }}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

// Grid of scam report cards
function ScamReportGrid({ reports }: { reports: ScamReportWithUserDetail[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-8 mt-8">
      {reports.map((report) => (
        <ScamReportCard
          key={report.reportId + report.createdAt}
          report={report}
        />
      ))}
    </div>
  );
}

// Pagination controls
function ScamReportsPagination({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  currentPage,
}: {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  currentPage: number;
}) {
  return (
    <Pagination className="mt-10 mb-4">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={hasPrev ? onPrev : undefined}
            aria-disabled={!hasPrev}
          />
        </PaginationItem>
        <PaginationItem>
          <span className="px-4 py-2 font-mono text-lg">
            Page {currentPage}
          </span>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            onClick={hasNext ? onNext : undefined}
            aria-disabled={!hasNext}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export default function ScamReportsPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [lastEvaluatedKey, setLastEvaluatedKey] = useState<any>(undefined);
  const [page, setPage] = useState(1);

  // Determine mode
  const isSearching = search.trim() !== "";

  // Data hooks
  const {
    reports,
    lastEvaluatedKey: nextKey,
    loading,
    isError,
    error,
  } = isSearching
    ? useSearchedScamReports(search, 6, lastEvaluatedKey)
    : useScamReportsWithUserDetail(6, lastEvaluatedKey);

  // Handlers
  const handleSearch = useCallback(() => {
    setLastEvaluatedKey(undefined);
    setPage(1);
    setSearch(searchInput.trim());
  }, [searchInput]);

  const handleInputChange = (val: string) => {
    setSearchInput(val);
    if (val.trim() === "") {
      setSearch("");
      setLastEvaluatedKey(undefined);
      setPage(1);
    }
  };

  const handlePrev = () => {
    // For cursor-based pagination, you need to keep a stack of previous keys
    // For simplicity, we only support forward pagination here
    // You can extend this to support backward navigation if you store previous keys in an array
  };

  const handleNext = () => {
    setLastEvaluatedKey(nextKey);
    setPage(page + 1);
  };

  // UI
  return (
    <div className="max-w-7xl mx-auto px-4">
      <h1 className="text-4xl font-sans-bold mt-10">Scam Reports Forum</h1>
      <ScamReportsSearchBar
        search={searchInput}
        setSearch={handleInputChange}
        onSearch={handleSearch}
        loading={loading}
      />
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner size="large" color="violet" />
        </div>
      ) : isError ? (
        <Alert variant="destructive" className="mt-10">
          <AlertDescription>
            {error?.message || "Failed to load scam reports."}
          </AlertDescription>
        </Alert>
      ) : reports.length === 0 ? (
        <div className="flex justify-center items-center h-64 text-xl text-muted-foreground">
          No scam reports found.
        </div>
      ) : (
        <>
          <ScamReportGrid reports={reports} />
          <ScamReportsPagination
            hasPrev={false} // Not implemented
            hasNext={!!nextKey}
            onPrev={handlePrev}
            onNext={handleNext}
            currentPage={page}
          />
        </>
      )}
    </div>
  );
}
