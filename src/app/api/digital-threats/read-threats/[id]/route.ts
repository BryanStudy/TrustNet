import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { verifyAuth } from "@/utils/auth";
import { DigitalThreat } from "@/types/digital-threats";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await verifyAuth(req);
  } catch (error) {
    return NextResponse.json(
      { error: "User is not authenticated" },
      { status: 401 }
    );
  }

  const threatId = params.id;

  try {
    const command = new GetCommand({
      TableName: "digital-threats",
      Key: { threatId },
    });
    const { Item } = await ddbDocClient.send(command);
    if (!Item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(Item as DigitalThreat);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch threat" },
      { status: 500 }
    );
  }
}
