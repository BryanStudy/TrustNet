import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/utils/auth";
import { toggleUserSubscription } from "@/utils/threatNotifications";

export async function PUT(req: NextRequest) {
  try {
    // Verify user authentication
    const userPayload = await verifyAuth(req);
    const userId = userPayload.userId as string;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user ID in token" },
        { status: 400 }
      );
    }

    const { enabled } = await req.json();

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled field must be a boolean" },
        { status: 400 }
      );
    }

    // Toggle user's subscription
    await toggleUserSubscription(userId, enabled);

    return NextResponse.json({
      message: `Notifications ${enabled ? "enabled" : "disabled"} successfully`,
      subscribed: enabled,
    });
  } catch (error: any) {
    console.error("Error toggling subscription:", error);

    if (error.message.includes("not authenticated")) {
      return NextResponse.json(
        { error: "User is not authenticated" },
        { status: 401 }
      );
    }

    if (error.message.includes("attribute_exists")) {
      return NextResponse.json(
        { error: "No subscription found. Please subscribe first." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
