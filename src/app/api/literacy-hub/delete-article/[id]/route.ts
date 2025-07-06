import { NextRequest, NextResponse } from "next/server";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const command = new DeleteCommand({
      TableName: "articles",
      Key: { articleId: id },
    });
    await ddbDocClient.send(command);
    return NextResponse.json({ message: "Article deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json({ error: "Failed to delete article" }, { status: 500 });
  }
} 