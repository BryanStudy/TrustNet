"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MdNotifications, MdClose } from "react-icons/md";
import axios from "@/utils/axios";
import { toast } from "sonner";

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threatArtifact: string;
  onComplete: () => void;
}

export default function SubscriptionModal({
  open,
  onOpenChange,
  threatArtifact,
  onComplete,
}: SubscriptionModalProps) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/notifications/subscribe");

      if (response.status === 200) {
        toast.success(
          "Successfully subscribed to threat verification notifications!"
        );
        onOpenChange(false);
        onComplete();
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      toast.error(
        error.response?.data?.error || "Failed to subscribe to notifications"
      );
      // Still close modal and continue - don't block user
      onOpenChange(false);
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MdNotifications className="text-blue-600" />
            Stay Updated
          </DialogTitle>
          <DialogDescription>
            Get notified when your threat reports are verified by our admin
            team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              📋 <strong>Your threat:</strong> "{threatArtifact}"
            </AlertDescription>
          </Alert>

          <div className="text-sm text-gray-600">
            <p>We'll send you an email notification when:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Your threat reports are verified</li>
              <li>Important updates about your submissions</li>
            </ul>
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              💡 You can unsubscribe anytime by clicking the link in any
              notification email.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Subscribing..." : "Yes, notify me"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={loading}
              className="flex-1"
            >
              No, thanks
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
