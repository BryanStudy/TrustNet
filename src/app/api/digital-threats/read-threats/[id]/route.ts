import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { verifyAuth } from "@/utils/auth";
import { DigitalThreat } from "@/types/digital-threats";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    await verifyAuth(req);
  } catch (error) {
    return NextResponse.json(
      { error: "User is not authenticated" },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { createdAt } = body;
  if (!createdAt || typeof createdAt !== "string") {
    return NextResponse.json(
      { error: "createdAt is required and must be a string" },
      { status: 400 }
    );
  }

  try {
    // Fetch the threat
    const threatCommand = new GetCommand({
      TableName: "digital-threats",
      Key: { threatId: id, createdAt },
    });
    const { Item: threatItem } = await ddbDocClient.send(threatCommand);

    if (!threatItem) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const threat = threatItem as DigitalThreat;

    // Fetch the user details
    let reporterName = "Unknown User";
    try {
      const userCommand = new GetCommand({
        TableName: "users",
        Key: { userId: threat.submittedBy },
      });
      const { Item: userItem } = await ddbDocClient.send(userCommand);

      if (userItem && userItem.firstName && userItem.lastName) {
        reporterName = `${userItem.firstName} ${userItem.lastName}`;
      }
    } catch (userError) {
      // If user fetch fails, keep "Unknown User" as fallback
      console.error("Failed to fetch user:", userError);
    }

    return NextResponse.json({
      threat,
      reporterName,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch threat" },
      { status: 500 }
    );
  }
}
