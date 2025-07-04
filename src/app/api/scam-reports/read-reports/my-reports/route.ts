import { NextRequest, NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { verifyAuth } from "@/utils/auth";
import { ScamReport } from "@/types/scam-reports";

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
      TableName: "scam-reports",
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ScanIndexForward: false, // newest first
      Limit: 25,
    });

    const { Items } = await ddbDocClient.send(command);

    return NextResponse.json({
      reports: Items as ScamReport[],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch scam reports" },
      { status: 500 }
    );
  }
}
