"use client";

import ProtectedSidebar from "@/components/layout/protected-sidebar";
import { Spinner } from "@/components/spinner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import ErrorWrapper from "@/components/wrapper/error-wrapper";
import SpinnerWrapper from "@/components/wrapper/spinner-wrapper";
import { useUser } from "@/hooks/useUser";
import { ReactNode } from "react";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { userInfo, loading, isError } = useUser();

  if (loading) <SpinnerWrapper />;
  if (isError || !userInfo) <ErrorWrapper message="Failed to load user data" />;

  return (
    <SidebarProvider>
      {userInfo && (
        <>
          <ProtectedSidebar userInfo={userInfo} />
          <main className="flex-1">{children}</main>
        </>
      )}
    </SidebarProvider>
  );
}
