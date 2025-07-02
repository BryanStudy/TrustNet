"use client";

import DigitalThreatsModal from "@/components/digital-threats/digital-threats-create-modal";
import { DigitalThreatsTable } from "@/components/digital-threats/digital-threats-table";
import { useMyDigitalThreats } from "@/hooks/useDigitalThreats";

export default function MyThreatsPage() {
  const { digitalThreats, loading, isError, refetch } = useMyDigitalThreats();

  return (
    <div className="flex flex-col max-w-7xl mx-auto">
      <h1 className="text-4xl font-sans-bold mt-10">My Threats</h1>
      <div className="flex justify-between my-8">
        <div className="font-mono text-md flex items-center gap-2">
          Showing{" "}
          <p className="font-mono-bold text-[var(--c-violet)]">
            {digitalThreats.length}
          </p>{" "}
          Result
          {digitalThreats.length !== 1 ? "s" : ""}
        </div>
        <DigitalThreatsModal onRefetch={refetch} />
      </div>
      <DigitalThreatsTable
        threats={digitalThreats}
        isLoading={loading}
        isError={isError}
        onRefetch={refetch}
      />
    </div>
  );
}
