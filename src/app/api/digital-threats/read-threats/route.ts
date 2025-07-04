import { DigitalThreat } from "@/types/digital-threats";
import { verifyAuth } from "@/utils/auth";
import ddbDocClient from "@/utils/dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await verifyAuth(req);
  } catch (error) {
    return NextResponse.json(
      { error: "User is not authenticated" },
      { status: 401 }
    );
  }

  try {
    const command = new QueryCommand({
      TableName: "digital-threats",
      IndexName: "viewable-createdAt-index",
      KeyConditionExpression: "viewable = :threats",
      ExpressionAttributeValues: {
        ":threats": "THREATS",
      },
      ScanIndexForward: false, // newest first
      Limit: 50,
    });

    const { Items } = await ddbDocClient.send(command);

    return NextResponse.json({
      threats: Items as DigitalThreat[],
    });
  } catch (error) {
    console.error("Error fetching threats:", error);
    return NextResponse.json(
      { error: "Failed to fetch threats" },
      { status: 500 }
    );
  }
}
