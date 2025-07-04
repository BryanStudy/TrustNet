"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MyReportsTable } from "@/components/scam-reports/my-reports-table";
import { useMyScamReports } from "@/hooks/useScamReports";
import { IoSearchOutline } from "react-icons/io5";
import { FiEdit } from "react-icons/fi";

export default function MyReportsPage() {
  const router = useRouter();
  const { scamReports, loading, isError, refetch } = useMyScamReports();
  const [search, setSearch] = useState("");

  // Filtering logic
  const filteredReports = useMemo(() => {
    return scamReports.filter((report) =>
      report.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [scamReports, search]);

  return (
    <div className="flex flex-col max-w-7xl mx-auto">
      <h1 className="text-4xl font-sans-bold mt-10">My Reports</h1>
      <div className="mt-10">
        <div className="relative w-full">
          <IoSearchOutline className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title..."
            className={
              "pl-12 pr-4 py-6 border border-[var(--c-mauve)] rounded-none font-mono text-base bg-[var(--c-white)] w-full " +
              "placeholder:font-mono placeholder:text-gray-600 " +
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--c-violet)]"
            }
          />
        </div>
      </div>
      <div className="flex justify-between my-8">
        <div className="font-mono text-md flex items-center gap-2">
          Showing{" "}
          <p className="font-mono-bold text-[var(--c-violet)]">
            {filteredReports.length}
          </p>{" "}
          Result{filteredReports.length !== 1 ? "s" : ""}
        </div>
        <Button
          className="bg-[var(--c-violet)] font-mono hover:bg-[var(--c-violet)]/80 flex items-center gap-2 text-white px-6 py-2 rounded-lg"
          onClick={() => router.push("/scam-reports/new")}
        >
          <FiEdit />
          Create New Report
        </Button>
      </div>
      <div className="mt-6">
        <MyReportsTable
          reports={filteredReports}
          isLoading={loading}
          isError={isError}
        />
      </div>
    </div>
  );
}
