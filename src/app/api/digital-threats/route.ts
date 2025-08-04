import { createDigitalThreatSchema } from "@/schema/digital-threats";
import { DigitalThreat } from "@/types/digital-threats";
import { verifyAuth } from "@/utils/auth";
import ddbDocClient from "@/utils/dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// Get all threats
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

// Create threat
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
    const body = await req.json();
    const validationResult = createDigitalThreatSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.message },
        { status: 400 }
      );
    }

    // check if artifact already exists
    const findArtifactCommand = new QueryCommand({
      TableName: "digital-threats",
      IndexName: "artifact-createdAt-index",
      KeyConditionExpression: "artifact = :artifact",
      ExpressionAttributeValues: { ":artifact": body.artifact },
      Limit: 1,
    });
    const { Items } = await ddbDocClient.send(findArtifactCommand);
    const existingThreat = Items && Items[0];
    if (existingThreat) {
      return NextResponse.json(
        { error: "Artifact already exists" },
        { status: 403 }
      );
    }

    const threatId = uuidv4();
    const submittedBy = userPayload.userId;
    const createdAt = new Date().toISOString();
    const updatedAt = new Date().toISOString();
    const status = "unverified";
    const likes = 0;

    const newThreat: DigitalThreat = {
      threatId,
      submittedBy,
      createdAt,
      updatedAt,
      status,
      likes,
      ...body,
      viewable: "THREATS",
    };

    const putDigitalThreatCommand = new PutCommand({
      TableName: "digital-threats",
      Item: newThreat,
    });
    await ddbDocClient.send(putDigitalThreatCommand);

    return NextResponse.json(
      { message: "Digital threat created successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating digital threat:", error);
    return NextResponse.json(
      { error: "Failed to create digital threat" },
      { status: 500 }
    );
  }
}
