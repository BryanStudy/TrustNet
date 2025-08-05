"use client";

import React, { useState, useMemo } from "react";
import DigitalThreatsModal from "@/components/digital-threats/digital-threats-create-modal";
import { DigitalThreatsTable } from "@/components/digital-threats/digital-threats-table";
import { DigitalThreatsSearchBar } from "@/components/digital-threats/digital-threats-search-bar";
import NotificationSettingsModal from "@/components/digital-threats/notification-settings-modal";
import { Button } from "@/components/ui/button";
import { MdNotifications } from "react-icons/md";
import { useMyDigitalThreats } from "@/hooks/useDigitalThreats";

export default function MyThreatsPage() {
  const { digitalThreats, loading, isError, refetch } = useMyDigitalThreats();

  // Filter/search state
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [notificationSettingsOpen, setNotificationSettingsOpen] =
    useState(false);

  // Filtering logic
  const filteredThreats = useMemo(() => {
    return digitalThreats.filter((threat) => {
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
  }, [digitalThreats, search, type, status]);

  return (
    <div className="flex flex-col max-w-7xl mx-auto">
      <h1 className="text-4xl font-sans-bold mt-10">My Threats</h1>
      <DigitalThreatsSearchBar
        search={search}
        onSearchChange={setSearch}
        type={type}
        onTypeChange={setType}
        status={status}
        onStatusChange={setStatus}
        className="mt-10"
      />
      <div className="flex justify-between my-8">
        <div className="font-mono text-md flex items-center gap-2">
          Showing{" "}
          <p className="font-mono-bold text-[var(--c-violet)]">
            {filteredThreats.length}
          </p>{" "}
          Result
          {filteredThreats.length !== 1 ? "s" : ""}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setNotificationSettingsOpen(true)}
            className="flex items-center gap-2"
          >
            <MdNotifications className="h-4 w-4" />
            Notification Settings
          </Button>
          <DigitalThreatsModal onRefetch={refetch} />
        </div>
      </div>
      <div className="mt-6">
        <DigitalThreatsTable
          threats={filteredThreats}
          isLoading={loading}
          isError={isError}
          onRefetch={refetch}
        />
      </div>

      <NotificationSettingsModal
        open={notificationSettingsOpen}
        onOpenChange={setNotificationSettingsOpen}
      />
    </div>
  );
}
