import { NextRequest, NextResponse } from "next/server";
import { TransactWriteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { verifyAuth } from "@/utils/auth";

const DIGITAL_THREATS_TABLE = "digital-threats";
const THREAT_LIKES_TABLE = "threat-likes";

export async function POST(
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { createdAt } = body;
  if (!createdAt || typeof createdAt !== "string") {
    return NextResponse.json(
      { error: "createdAt is required and must be a string" },
      { status: 400 }
    );
  }

  // Idempotency: check if user already liked
  const likeKey = { userId, threatId };
  try {
    const getLike = new GetCommand({
      TableName: THREAT_LIKES_TABLE,
      Key: likeKey,
    });
    const { Item: likeItem } = await ddbDocClient.send(getLike);
    if (likeItem) {
      return NextResponse.json({ message: "Already liked" }, { status: 200 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check like status" },
      { status: 500 }
    );
  }

  // Upvote transaction
  try {
    const transactCmd = new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: DIGITAL_THREATS_TABLE,
            Key: { threatId, createdAt },
            UpdateExpression: "SET likes = if_not_exists(likes, :zero) + :inc",
            ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
            ConditionExpression:
              "attribute_exists(threatId) AND attribute_exists(createdAt)",
          },
        },
        {
          Put: {
            TableName: THREAT_LIKES_TABLE,
            Item: { userId, threatId, createdAt },
            ConditionExpression:
              "attribute_not_exists(userId) AND attribute_not_exists(threatId)",
          },
        },
      ],
    });
    await ddbDocClient.send(transactCmd);
    return NextResponse.json(
      { message: "Liked successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    // If ConditionalCheckFailed, treat as idempotent
    if (error.name === "TransactionCanceledException") {
      return NextResponse.json({ message: "Already liked" }, { status: 200 });
    }
    return NextResponse.json(
      { error: "Failed to like threat" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { createdAt } = body;
  if (!createdAt || typeof createdAt !== "string") {
    return NextResponse.json(
      { error: "createdAt is required and must be a string" },
      { status: 400 }
    );
  }

  // Idempotency: check if user has not liked
  const likeKey = { userId, threatId };
  try {
    const getLike = new GetCommand({
      TableName: THREAT_LIKES_TABLE,
      Key: likeKey,
    });
    const { Item: likeItem } = await ddbDocClient.send(getLike);
    if (!likeItem) {
      return NextResponse.json({ message: "Already unliked" }, { status: 200 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check like status" },
      { status: 500 }
    );
  }

  // Downvote transaction
  try {
    const transactCmd = new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: DIGITAL_THREATS_TABLE,
            Key: { threatId, createdAt },
            UpdateExpression: "SET likes = if_not_exists(likes, :zero) - :dec",
            ConditionExpression:
              "attribute_exists(threatId) AND attribute_exists(createdAt) AND likes > :zero",
            ExpressionAttributeValues: { ":dec": 1, ":zero": 0 },
          },
        },
        {
          Delete: {
            TableName: THREAT_LIKES_TABLE,
            Key: likeKey,
            ConditionExpression:
              "attribute_exists(userId) AND attribute_exists(threatId)",
          },
        },
      ],
    });
    await ddbDocClient.send(transactCmd);
    return NextResponse.json(
      { message: "Unliked successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    // If ConditionalCheckFailed, treat as idempotent
    if (error.name === "TransactionCanceledException") {
      return NextResponse.json({ message: "Already unliked" }, { status: 200 });
    }
    return NextResponse.json(
      { error: "Failed to unlike threat" },
      { status: 500 }
    );
  }
}
