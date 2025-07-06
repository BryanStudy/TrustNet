"use client";

import React, { useState, useMemo } from "react";
import { UsersTable } from "@/components/users/users-table";
import { UsersSearchBar } from "@/components/users/users-search-bar";
import { useUsers } from "@/hooks/useUser";

interface User {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  picture: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const { users, loading, isError, refetch } = useUsers();

  // Filter/search state
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");

  // Filtering logic
  const filteredUsers = useMemo(() => {
    return users.filter((user: User) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        search === "" ||
        (user.firstName + " " + user.lastName).toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower);
      const matchesRole = role === "all" || role === "" || user.role === role;
      return matchesSearch && matchesRole;
    });
  }, [users, search, role]);

  return (
    <div className="flex flex-col max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-sans-bold text-[var(--c-coal)] mb-2">
            Users
          </h1>
          <h2 className="text-xl font-mono text-gray-600">
            Manage System Users
          </h2>
        </div>
      </div>

      <UsersSearchBar
        search={search}
        onSearchChange={setSearch}
        role={role}
        onRoleChange={setRole}
        className=""
      />

      <div className="flex justify-between my-8">
        <div className="font-mono text-md flex items-center gap-2">
          Showing{" "}
          <p className="font-mono-bold text-[var(--c-violet)]">
            {filteredUsers.length}
          </p>{" "}
          Result
          {filteredUsers.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <UsersTable
          users={filteredUsers}
          isLoading={loading}
          isError={isError}
          onRefetch={refetch}
        />
      </div>
    </div>
  );
}