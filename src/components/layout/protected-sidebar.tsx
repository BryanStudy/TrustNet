"use client";

import { UserInfo } from "@/hooks/useUser";
import { AiFillSecurityScan } from "react-icons/ai";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import Link from "next/link";
import { useState } from "react";
import { adminSidebar, customerSidebar } from "@/config/sidebar";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  userInfo: UserInfo;
}

export default function ProtectedSidebar({ userInfo }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const menu = userInfo.role === "customer" ? customerSidebar : adminSidebar;

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  return (
    <Sidebar className="border-r border-[--c-gray] bg-[--c-white] ">
      {/* Header Here */}
      <SidebarHeader className="mx-4 py-6">
        <div className="flex gap-3 my-4 items-center">
          <AiFillSecurityScan className="text-4xl text-[var(--c-violet)] shrink-0" />
          <div className="text-[1.5rem] font-mono mr-8">TrustNet</div>
        </div>
      </SidebarHeader>
      {/* Content Here */}
      <SidebarContent>
        {menu.map((item) => {
          const isOpen = openSections[item.label];
          if (item.children && item.children.length > 0) {
            return (
              <SidebarGroup key={item.label}>
                <SidebarMenuItem className="px-4">
                  <SidebarMenuButton
                    onClick={() => toggleSection(item.label)}
                    className="flex justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {item.icon && (
                        <item.icon className="text-lg text-[var(--c-coal)] mr-2" />
                      )}
                      {item.label}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="text-[var(--c-coal)] font-light" />
                    ) : (
                      <ChevronRight className="text-[var(--c-coal)] font-light" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isOpen && (
                  <SidebarGroupContent className="ml-8 border-l-2 border-[--c-gray] pl-4 space-y-1 max-w-[calc(100%-3rem)]">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="text-xs block hover:text-[var(--c-violet)] my-2 ml-2"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            );
          }
          return (
            <SidebarGroup key={item.label}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href={item.href!} className="flex items-center gap-2">
                    {item.icon && <item.icon />}
                    {item.label}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      {/* Footer Here */}
      <SidebarFooter>
        <p>{userInfo.firstName}</p>
        <p>{userInfo.role}</p>
      </SidebarFooter>
    </Sidebar>
  );
}
