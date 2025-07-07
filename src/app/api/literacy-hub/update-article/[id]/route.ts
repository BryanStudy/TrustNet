import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { updateArticleSchema } from "@/schema/articles";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    // Validate input using the update schema
    const validation = updateArticleSchema.safeParse(body);
    if (!validation.success) {
      // Join all error messages for clarity
      const messages = validation.error.errors.map(e => e.message).join(" | ");
      return NextResponse.json({ error: messages }, { status: 400 });
    }

    // Get the existing article first
    const getCommand = new GetCommand({
      TableName: "articles",
      Key: { articleId: id },
    });
    const { Item: existingArticle } = await ddbDocClient.send(getCommand);
    if (!existingArticle) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Build update expression
    const allowedFields = ["title", "content", "category", "readTime", "coverImage"];
    const updateFields: any = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateFields[key] = body[key];
    }
    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Build UpdateExpression
    const updateExpr = [];
    const exprAttrNames: any = {};
    const exprAttrValues: any = {};
    for (const key of Object.keys(updateFields)) {
      updateExpr.push(`#${key} = :${key}`);
      exprAttrNames[`#${key}`] = key;
      exprAttrValues[`:${key}`] = updateFields[key];
    }
    exprAttrNames["#updatedAt"] = "updatedAt";
    exprAttrValues[":updatedAt"] = new Date().toISOString();
    updateExpr.push(`#updatedAt = :updatedAt`);

    const command = new UpdateCommand({
      TableName: "articles",
      Key: { articleId: id },
      UpdateExpression: `SET ${updateExpr.join(", ")}`,
      ExpressionAttributeNames: exprAttrNames,
      ExpressionAttributeValues: exprAttrValues,
      ReturnValues: "ALL_NEW",
    });

    const { Attributes: updated } = await ddbDocClient.send(command);
    if (!updated) {
      return NextResponse.json({ error: "Article not found after update" }, { status: 404 });
    }

    // Fetch author info
    let authorName = "Unknown User";
    let authorPicture = null;
    try {
      const userCommand = new GetCommand({
        TableName: "users",
        Key: { userId: updated.userId },
      });
      const { Item: userItem } = await ddbDocClient.send(userCommand);
      if (userItem && userItem.firstName && userItem.lastName) {
        authorName = `${userItem.firstName} ${userItem.lastName}`;
        authorPicture = userItem.picture || null;
      }
    } catch {}

    return NextResponse.json({ article: { ...updated, authorName, authorPicture } }, { status: 200 });
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
  }
} 