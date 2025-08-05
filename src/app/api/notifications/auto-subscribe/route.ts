import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/utils/auth";
import { autoSubscribeUser } from "@/utils/threatNotifications";

export async function POST(req: NextRequest) {
  let userPayload;
  try {
    userPayload = await verifyAuth(req);
  } catch (error) {
    return NextResponse.json(
      { error: "User is not authenticated" },
      { status: 401 }
    );
  }

  try {
    // Auto-subscribe the authenticated user using their email from JWT
    await autoSubscribeUser(userPayload.email as string);

    return NextResponse.json({
      message: "Auto-subscribed successfully",
      email: userPayload.email,
    });
  } catch (error) {
    console.error("Error auto-subscribing user:", error);
    return NextResponse.json(
      { error: "Failed to auto-subscribe" },
      { status: 500 }
    );
  }
}
