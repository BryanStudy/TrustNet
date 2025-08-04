import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/utils/auth";
import ddbDocClient from "@/utils/dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

const THREAT_LIKES_TABLE = process.env.THREAT_LIKES_TABLE || "threat-likes";
const DIGITAL_THREATS_TABLE =
  process.env.DIGITAL_THREATS_TABLE || "digital-threats";

// GSI names
const USERID_INDEX = "userId-index";
const THREATID_INDEX = "threatId-index";

// Get liked threats
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    const userId = payload.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Query threat-likes table for this user's likes (limit 25)
    const likesResult = await ddbDocClient.send(
      new QueryCommand({
        TableName: THREAT_LIKES_TABLE,
        IndexName: USERID_INDEX,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
        Limit: 25,
      })
    );
    const likedThreats = likesResult.Items || [];
    if (likedThreats.length === 0) {
      return NextResponse.json([]);
    }
    const threatIds = likedThreats.map((like: any) => like.threatId);

    // 2. Query digital-threats table for all threatIds (using GSI)
    const uniqueThreatIds = Array.from(new Set(threatIds));
    const digitalThreats: any[] = [];
    for (const threatId of uniqueThreatIds) {
      const threatResult = await ddbDocClient.send(
        new QueryCommand({
          TableName: DIGITAL_THREATS_TABLE,
          IndexName: THREATID_INDEX,
          KeyConditionExpression: "threatId = :tid",
          ExpressionAttributeValues: { ":tid": threatId },
        })
      );
      if (threatResult.Items && threatResult.Items.length > 0) {
        digitalThreats.push(...threatResult.Items);
      }
    }
    return NextResponse.json(digitalThreats);
  } catch (error) {
    console.error("Failed to fetch liked digital threats:", error);
    return NextResponse.json(
      { error: "Failed to fetch liked digital threats" },
      { status: 500 }
    );
  }
}
