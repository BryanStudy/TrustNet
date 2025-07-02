import React, { useState } from "react";
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
import { FaLink, FaPhoneAlt, FaEdit, FaTrash } from "react-icons/fa";
import { DigitalThreat } from "@/types/digital-threats";
import { IoMail } from "react-icons/io5";
import DigitalThreatsUpdateModal from "./digital-threats-update-modal";

interface DigitalThreatsTableProps {
  threats: DigitalThreat[];
  onRefetch: () => void;
  isLoading?: boolean;
  isError?: boolean;
}

const typeIconMap = {
  url: <FaLink className="text-[var(--c-violet)]" size={20} />,
  email: <IoMail className="text-[var(--c-violet)]" size={20} />,
  phone: <FaPhoneAlt className="text-[var(--c-violet)]" size={20} />,
};

export const DigitalThreatsTable: React.FC<DigitalThreatsTableProps> = ({
  threats,
  onRefetch,
  isLoading,
  isError,
}) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedThreat, setSelectedThreat] = useState<DigitalThreat | null>(
    null
  );

  // Handler for row click
  const handleRowClick = (threatId: string) => {
    toast.success(`Threat ID: ${threatId}`);
  };

  // Handler for edit
  const handleEdit = (threat: DigitalThreat) => {
    setSelectedThreat(threat);
    setEditModalOpen(true);
  };

  // Handler for delete (stub)
  const handleDelete = (threat: DigitalThreat) => {
    // TODO: Implement delete logic (API call)
    toast.error(`Deleted threat: ${threat.threatId}`);
    // on success: onRefetch();
  };

  return (
    <div className="w-full">
      <DigitalThreatsUpdateModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        threat={selectedThreat}
        onRefetch={onRefetch}
      />
      <Table className="w-full border border-[var(--c-mauve)] rounded-none">
        <TableHeader className="bg-[var(--c-mauve)] text-center">
          <TableRow>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Type
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Artifact
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Description
            </TableHead>
            <TableHead className="font-mono-bold text-center text-[1.0rem]">
              Status
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
              <TableCell colSpan={7} className="text-center py-8">
                Loading...
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-red-500">
                Error loading threats.
              </TableCell>
            </TableRow>
          ) : threats.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                No threats found.
              </TableCell>
            </TableRow>
          ) : (
            threats.map((threat) => (
              <TableRow
                key={threat.threatId}
                className="cursor-pointer hover:bg-[var(--c-mauve)]/40 transition-colors"
                onClick={() => handleRowClick(threat.threatId)}
              >
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    {typeIconMap[threat.type]}
                  </div>
                </TableCell>
                <TableCell className="text-center max-w-[20vw] text-ellipsis overflow-hidden">
                  {threat.artifact}
                </TableCell>
                <TableCell className="text-center max-w-[30vw] text-ellipsis overflow-hidden">
                  {threat.description}
                </TableCell>
                <TableCell className="text-center">
                  {threat.status === "verified" ? "Verified" : "Unverified"}
                </TableCell>
                <TableCell className="text-center">
                  {new Date(threat.updatedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell
                  className="text-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(threat);
                  }}
                >
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Edit"
                    className="bg-[var(--c-mauve)]"
                  >
                    <FaEdit />
                  </Button>
                </TableCell>
                <TableCell
                  className="text-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(threat);
                  }}
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
