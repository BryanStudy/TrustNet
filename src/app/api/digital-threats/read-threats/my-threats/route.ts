import { NextRequest, NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { verifyAuth } from "@/utils/auth";
import { DigitalThreat } from "@/types/digital-threats";

export async function GET(req: NextRequest) {
  let userPayload;
  try {
    userPayload = await verifyAuth(req);
  } catch (error) {
    return NextResponse.json(
      { error: "User is not authenticated" },
      { status: 401 }
    );
  }

  const userId = userPayload.userId;

  try {
    const command = new QueryCommand({
      TableName: "digital-threats",
      IndexName: "submittedBy-createdAt-index",
      KeyConditionExpression: "submittedBy = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ScanIndexForward: false, // newest first
      Limit: 50,
    });

    const { Items } = await ddbDocClient.send(command);

    return NextResponse.json({
      threats: Items as DigitalThreat[],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch threats" },
      { status: 500 }
    );
  }
}
