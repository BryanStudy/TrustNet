import { AiOutlineScan } from "react-icons/ai";
import { TbReportSearch } from "react-icons/tb";
import { HiOutlineBookOpen } from "react-icons/hi";
import { IconType } from "react-icons/lib";

export type SidebarItem = {
  label: string;
  icon?: IconType;
  href?: string;
  children?: {
    label: string;
    href: string;
  }[];
};

// Customer Sidebar
export const customerHome = "/digital-threats";
export const customerSidebar: SidebarItem[] = [
  {
    label: "Digital Threats",
    icon: AiOutlineScan,
    children: [
      { label: "Directory", href: "/digital-threats" },
      { label: "My Threats", href: "/digital-threats/my-threats" },
      { label: "Liked Threats", href: "/digital-threats/liked-threats" },
    ],
  },
  {
    label: "Scam Reports",
    icon: TbReportSearch,
    children: [
      { label: "Forum", href: "/scam-reports" },
      { label: "My Reports", href: "/scams-reports/my-reports" },
    ],
  },
  {
    label: "Literacy Hub",
    icon: HiOutlineBookOpen,
    href: "/literacy",
    children: [{ label: "Articles Directory", href: "/literacy-hub" }],
  },
];

// Admin Sidebar
export const adminHome = "/digital-threats"; // you can change this to dashboard if you're making a dashboard for admin
export const adminSidebar: SidebarItem[] = [
  {
    label: "Digital Threats",
    icon: AiOutlineScan,
    children: [
      { label: "Directory", href: "/digital-threats" },
      { label: "My Threats", href: "/digital-threats#" },
      { label: "Liked Threats", href: "/digital-threats#" },
    ],
  },
  {
    label: "Scam Reports",
    icon: TbReportSearch,
    children: [
      { label: "Forum", href: "/scam-reports" },
      { label: "My Reports", href: "/scams-reports#" },
    ],
  },
  {
    label: "Literacy Hub",
    icon: HiOutlineBookOpen,
    href: "/literacy",
    children: [
      { label: "Articles Directory", href: "/literacy-hub" },
      { label: "My Articles", href: "/literacy-hub#" },
    ],
  },
];
