"use client";

import { useSearchParams } from "next/navigation";
import { useScamReportWithUserDetail } from "@/hooks/useScamReports";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FaUser } from "react-icons/fa";

export default function ScamReportDetailsPage() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get("reportId") || "";
  const createdAt = searchParams.get("createdAt") || "";

  const { report, loading, isError, error } = useScamReportWithUserDetail(
    reportId,
    createdAt
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="large" color="violet" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <Alert variant="destructive" className="mt-10 max-w-xl mx-auto">
        <AlertDescription>
          {error?.message || "Failed to load scam report details."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-2 text-muted-foreground font-mono-bold text-lg tracking-wide">
        Scam Report Details
      </div>
      <h1 className="text-4xl font-sans-bold my-4 leading-tight">
        {report.title}
      </h1>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {report.anonymized ? (
            <span className="inline-flex items-center justify-center rounded-full bg-[var(--c-violet)] text-white w-8 h-8">
              <FaUser className="text-lg" />
            </span>
          ) : (
            <Avatar className="w-8 h-8">
              <AvatarImage
                src={report.reporterPicture}
                alt={report.reporterName}
              />
            </Avatar>
          )}
          <span className="font-sans text-base">
            {report.anonymized ? "Anonymous User" : report.reporterName}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {new Date(report.createdAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
      <Separator className="mb-10" />
      {report.image && (
        <div className="flex justify-center mb-10">
          <div className="w-full max-w-md aspect-[4/3]">
            <a href={report.image} target="_blank" rel="noopener noreferrer">
              <img
                src={report.image}
                alt="Scam Report Image"
                className="object-contain rounded-lg w-full h-auto"
                style={{ aspectRatio: "4/3" }}
              />
            </a>
          </div>
        </div>
      )}
      <div className="font-sans text-lg leading-relaxed">
        {report.description}
      </div>
    </div>
  );
}
