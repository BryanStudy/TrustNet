import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { verifyAuth } from "@/utils/auth";

const THREAT_LIKES_TABLE = "threat-likes";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: threatId } = await context.params;
  let userId: string;
  try {
    const payload = await verifyAuth(req);
    userId = payload.userId as string;
    if (!userId) throw new Error();
  } catch {
    return NextResponse.json(
      { error: "User is not authenticated" },
      { status: 401 }
    );
  }

  if (!threatId || typeof threatId !== "string") {
    return NextResponse.json(
      { error: "threatId is required in the URL" },
      { status: 400 }
    );
  }

  try {
    const getLike = new GetCommand({
      TableName: THREAT_LIKES_TABLE,
      Key: { userId, threatId },
    });
    const { Item } = await ddbDocClient.send(getLike);
    return NextResponse.json({ liked: !!Item });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check like status" },
      { status: 500 }
    );
  }
}
