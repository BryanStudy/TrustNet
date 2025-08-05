import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/utils/auth";
import { getUserSubscriptionStatus } from "@/utils/threatNotifications";

export async function GET(req: NextRequest) {
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

    // Get user's subscription status
    const subscriptionStatus = await getUserSubscriptionStatus(userId);

    return NextResponse.json({
      subscribed: subscriptionStatus.subscribed,
      email: subscriptionStatus.email,
    });
  } catch (error: any) {
    console.error("Error checking subscription status:", error);

    if (error.message.includes("not authenticated")) {
      return NextResponse.json(
        { error: "User is not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to check subscription status" },
      { status: 500 }
    );
  }
}
