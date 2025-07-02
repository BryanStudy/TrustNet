import { NextRequest, NextResponse } from "next/server";
import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { verifyAuth } from "@/utils/auth";

export async function DELETE(
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

  // Check if item exists
  try {
    const getCmd = new GetCommand({
      TableName: "digital-threats",
      Key: { threatId: id, createdAt },
    });
    const { Item } = await ddbDocClient.send(getCmd);
    if (!Item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch threat" },
      { status: 500 }
    );
  }

  // Delete item
  try {
    const deleteCmd = new DeleteCommand({
      TableName: "digital-threats",
      Key: { threatId: id, createdAt },
    });
    await ddbDocClient.send(deleteCmd);
    return NextResponse.json({ message: "Threat deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete threat" },
      { status: 500 }
    );
  }
}
