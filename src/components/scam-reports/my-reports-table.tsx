import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ScamReport } from "@/types/scam-reports";
import { FaEdit, FaTrash } from "react-icons/fa";

interface MyReportsTableProps {
  reports: ScamReport[];
  isLoading?: boolean;
  isError?: boolean;
}

export const MyReportsTable: React.FC<MyReportsTableProps> = ({
  reports,
  isLoading,
  isError,
}) => {
  // Truncate description helper
  const truncate = (str: string, n: number) =>
    str.length > n ? str.slice(0, n - 1) + "…" : str;

  return (
    <div className="w-full">
      <Table className="w-full border border-[var(--c-mauve)] rounded-none">
        <TableHeader className="bg-[var(--c-mauve)] text-center">
          <TableRow>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Title
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Description
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Created At
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Updated At
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Edit
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Delete
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-[var(--c-white)] text-center font-mono">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                Loading...
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-red-500">
                Error loading reports.
              </TableCell>
            </TableRow>
          ) : reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                No Reports Found.
              </TableCell>
            </TableRow>
          ) : (
            reports.map((report) => (
              <TableRow
                key={report.reportId}
                className="cursor-pointer hover:bg-[var(--c-mauve)]/40 transition-colors"
                onClick={(e) => {
                  // Only toast if not clicking edit/delete
                  if (
                    (e.target as HTMLElement).closest("[data-action]") === null
                  ) {
                    toast.info(`ReportId: ${report.reportId}`);
                  }
                }}
              >
                <TableCell className="text-center max-w-[200px] text-ellipsis overflow-hidden">
                  {report.title}
                </TableCell>
                <TableCell className="text-center max-w-[400px] text-ellipsis overflow-hidden">
                  {truncate(report.description, 80)}
                </TableCell>
                <TableCell className="text-center">
                  {new Date(report.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="text-center">
                  {new Date(report.updatedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell
                  className="text-center"
                  data-action="edit"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Edit"
                    className="bg-[var(--c-mauve)] text-[var(--c-violet)]"
                  >
                    <FaEdit />
                  </Button>
                </TableCell>
                <TableCell
                  className="text-center"
                  data-action="delete"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="destructive"
                    size="icon"
                    aria-label="Delete"
                    className="bg-[var(--c-violet)]"
                  >
                    <FaTrash />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
