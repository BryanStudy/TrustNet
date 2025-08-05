import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/utils/auth";
import { subscribeUserGlobally } from "@/utils/threatNotifications";

export async function POST(req: NextRequest) {
  try {
    // Verify user authentication
    const userPayload = await verifyAuth(req);
    const userId = userPayload.userId as string;
    const email = userPayload.email as string;

    if (!userId || !email) {
      return NextResponse.json(
        { error: "Missing user ID or email in token" },
        { status: 400 }
      );
    }

    // Subscribe user globally to threat notifications
    await subscribeUserGlobally(userId, email);

    return NextResponse.json({
      message: "Successfully subscribed to threat verification notifications",
      subscribed: true,
    });
  } catch (error: any) {
    console.error("Error subscribing user:", error);

    if (error.message.includes("not authenticated")) {
      return NextResponse.json(
        { error: "User is not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to subscribe to notifications" },
      { status: 500 }
    );
  }
}
