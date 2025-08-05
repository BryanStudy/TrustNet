"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/spinner";
import { MdNotifications, MdNotificationsOff } from "react-icons/md";
import axios from "@/utils/axios";
import { toast } from "sonner";

interface NotificationSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SubscriptionStatus {
  subscribed: boolean;
  email?: string;
}

export default function NotificationSettingsModal({
  open,
  onOpenChange,
}: NotificationSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>({
      subscribed: false,
    });

  // Fetch subscription status when modal opens
  useEffect(() => {
    if (open) {
      fetchSubscriptionStatus();
    }
  }, [open]);

  const fetchSubscriptionStatus = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/notifications/status");
      setSubscriptionStatus(response.data);
    } catch (error: any) {
      console.error("Error fetching subscription status:", error);
      toast.error("Failed to load notification settings");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubscription = async (enabled: boolean) => {
    setUpdating(true);
    try {
      const response = await axios.put("/notifications/toggle", { enabled });

      if (response.status === 200) {
        setSubscriptionStatus((prev) => ({ ...prev, subscribed: enabled }));
        toast.success(
          enabled
            ? "Notifications enabled successfully!"
            : "Notifications disabled successfully!"
        );
      }
    } catch (error: any) {
      console.error("Error toggling subscription:", error);

      if (error.response?.status === 404) {
        toast.error(
          "No subscription found. Please create a threat first and subscribe when prompted."
        );
      } else {
        toast.error(
          error.response?.data?.error ||
            "Failed to update notification settings"
        );
      }
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MdNotifications className="text-blue-600" />
            Notification Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="large" color="violet" />
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-medium">
                      Threat Verification Notifications
                    </h4>
                    <p className="text-sm text-gray-600">
                      Get email notifications when your threats are verified
                    </p>
                  </div>
                  <Switch
                    checked={subscriptionStatus.subscribed}
                    onCheckedChange={handleToggleSubscription}
                    disabled={updating}
                  />
                </div>

                {subscriptionStatus.email && (
                  <Alert>
                    <AlertDescription className="text-sm">
                      📧 <strong>Email:</strong> {subscriptionStatus.email}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-xs text-gray-500 space-y-1">
                  <p>
                    • Notifications are sent when admins verify your threat
                    reports
                  </p>
                  <p>
                    • You can also unsubscribe directly from any notification
                    email
                  </p>
                  <p>• Changes take effect immediately</p>
                </div>
              </div>

              {subscriptionStatus.subscribed ? (
                <Alert>
                  <MdNotifications className="h-4 w-4" />
                  <AlertDescription>
                    You're subscribed to threat verification notifications.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <MdNotificationsOff className="h-4 w-4" />
                  <AlertDescription>
                    You won't receive threat verification notifications.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={updating}
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
