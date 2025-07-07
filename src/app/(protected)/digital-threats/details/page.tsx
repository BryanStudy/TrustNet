"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import {
  useDigitalThreat,
  useUpdateThreatStatus,
} from "@/hooks/useDigitalThreats";
import { useThreatLike } from "@/hooks/useThreatLike";
import { useUser } from "@/hooks/useUser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FaLink, FaRegHeart, FaHeart, FaHashtag } from "react-icons/fa";
import { LuLetterText } from "react-icons/lu";
import { HiOutlineHandRaised } from "react-icons/hi2";
import { IoMdHeartEmpty } from "react-icons/io";
import { LuClock, LuClock8 } from "react-icons/lu";
import { MdOutlineVerified } from "react-icons/md";
import { TbCategory } from "react-icons/tb";
import { IoCopyOutline } from "react-icons/io5";
import { IoMail } from "react-icons/io5";
import { FaPhoneAlt } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FaSpinner } from "react-icons/fa";

const typeIconMap: Record<string, React.ReactElement> = {
  url: <FaLink />,
  email: <IoMail />,
  phone: <FaPhoneAlt />,
};

function SummaryCard({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col items-start px-8 py-6 bg-[var(--c-white)] rounded-2xl min-w-[300px]",
        className
      )}
    >
      <div className="flex items-center text-[var(--c-violet)] font-mono-bold">
        <div className="flex items-center bg-[var(--c-mauve)] p-4 rounded-lg text-4xl">
          {icon}
        </div>
        <div className="flex flex-col ml-4 leading-none gap-y-1">
          <div className="font-mono-bold text-md text-[var(--c-violet)]">
            {label}
          </div>
          <div className="font-mono-bold text-[var(--c-coal)]">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function DetailsRow({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 mb-4", className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[var(--c-gray)]/75 text-xl">{icon}</span>
          <span className="font-mono-bold text-md text-[var(--c-violet)] min-w-[110px]">
            {label}
          </span>
        </div>
        <span className="font-mono text-black break-all pl-8 text-lg">
          {value}
        </span>
      </div>
    </div>
  );
}

export default function DigitalThreatDetailsPage() {
  const searchParams = useSearchParams();
  const threatId = searchParams.get("threatId");
  const createdAt = searchParams.get("createdAt");

  const { userInfo: currentUser } = useUser();
  const isAdmin = currentUser?.role === "admin";

  const {
    digitalThreat: threat,
    reporterName,
    loading: isLoading,
    isError,
    refetch,
  } = useDigitalThreat(
    threatId || "",
    createdAt ? decodeURIComponent(createdAt) : ""
  );

  // Integrate useThreatLike
  const { liked, likeLoading, likeError, handleLike, handleUnlike } =
    useThreatLike({
      threatId: threatId || "",
      createdAt: createdAt ? decodeURIComponent(createdAt) : "",
      refetchThreat: refetch,
    });

  // Status update mutation
  const { mutateAsync: updateStatus, isPending: statusUpdating } =
    useUpdateThreatStatus();

  React.useEffect(() => {
    if (likeError) {
      toast.error("Failed to update like status. Please try again.");
    }
  }, [likeError]);

  const handleStatusToggle = async () => {
    if (!threat || !threatId || !createdAt) return;

    const newStatus = threat.status === "verified" ? "unverified" : "verified";

    try {
      await updateStatus({
        threatId,
        createdAt: decodeURIComponent(createdAt),
        status: newStatus,
      });
      toast.success(`Threat marked as ${newStatus}`);
      refetch(); // Refresh the threat data
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to update status");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen max-w-7xl mx-auto mt-10">
        <h1 className="text-4xl font-sans-bold mb-8">Digital Threat Details</h1>
        <div className="text-center py-20">
          <p className="font-mono text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || !threat) {
    return (
      <div className="min-h-screen max-w-7xl mx-auto mt-10">
        <h1 className="text-4xl font-sans-bold mb-8">Digital Threat Details</h1>
        <div className="text-center py-20">
          <p className="font-mono text-lg text-red-500">
            Error loading threat information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-7xl mx-auto mt-10">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-sans-bold mb-8">Digital Threat Details</h1>
        <div className="flex items-center gap-3">
          {/* Admin-only verification toggle */}
          {isAdmin && (
            <Button
              variant={threat?.status === "verified" ? "default" : "outline"}
              size="sm"
              className={`flex items-center gap-2 cursor-pointer ${
                threat?.status === "verified"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "border-green-600 text-green-600 hover:bg-green-50"
              }`}
              onClick={handleStatusToggle}
              disabled={statusUpdating}
            >
              {statusUpdating ? (
                <FaSpinner className="animate-spin" />
              ) : (
                <MdOutlineVerified />
              )}
              {threat?.status === "verified" ? "Verified" : "Mark as Verified"}
            </Button>
          )}

          {/* Like button */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full border border-[var(--c-violet)] text-[var(--c-violet)] hover:bg-[var(--c-violet)]/10"
            onClick={
              liked
                ? handleUnlike
                : () => {
                    handleLike();
                    toast.success("You liked this threat!");
                  }
            }
            disabled={likeLoading}
          >
            {likeLoading ? (
              <FaSpinner className="animate-spin text-2xl" />
            ) : liked ? (
              <FaHeart className="text-2xl" />
            ) : (
              <FaRegHeart className="text-2xl" />
            )}
          </Button>
        </div>
      </div>
      <div className="mb-10">
        <div className="text-xl font-mono-bold text-gray-400 mb-4">Summary</div>
        <div className="flex gap-8 max-w-7xl">
          <SummaryCard
            icon={typeIconMap[threat.type]}
            label="Artifact"
            value={
              <span className="font-mono-bold text-xl">{threat.artifact}</span>
            }
            className="w-full"
          />
          <SummaryCard
            icon={<MdOutlineVerified />}
            label="Status"
            value={
              <span className="font-mono-bold text-xl capitalize">
                {threat.status}
              </span>
            }
          />
          <SummaryCard
            icon={<HiOutlineHandRaised />}
            label="Submitted By"
            value={
              <span className="font-mono-bold text-xl">
                {reporterName || "Unknown"}
              </span>
            }
          />
        </div>
      </div>
      <div className="text-xl font-mono-bold text-gray-400 mb-4">Details</div>
      <Card className="p-10 rounded-2xl bg-white">
        <div className="grid grid-cols-2 gap-x-12 gap-y-2">
          <DetailsRow
            icon={<FaHashtag />}
            label="Threat Id"
            value={threat.threatId}
          />
          <DetailsRow icon={<TbCategory />} label="Type" value={threat.type} />
          <DetailsRow
            icon={<IoCopyOutline />}
            label="Artifact"
            value={threat.artifact}
          />
          <DetailsRow
            icon={<MdOutlineVerified />}
            label="Status"
            value={threat.status}
          />
          <DetailsRow
            icon={<HiOutlineHandRaised />}
            label="Submitted By"
            value={reporterName || "Unknown"}
          />
          <DetailsRow
            icon={<IoMdHeartEmpty />}
            label="Likes"
            value={threat.likes}
          />
          <DetailsRow
            icon={<LuClock />}
            label="Created At"
            value={new Date(threat.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          />
          <DetailsRow
            icon={<LuClock8 />}
            label="Updated At"
            value={new Date(threat.updatedAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          />
          <DetailsRow
            icon={<LuLetterText />}
            label="Description"
            value={threat.description}
            className="col-span-2"
          />
        </div>
      </Card>
    </div>
  );
}
