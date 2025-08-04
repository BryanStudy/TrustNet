import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { updateArticleSchema } from "@/schema/articles";

// GET - Read single article
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "articleId is required." },
        { status: 400 }
      );
    }

    // First get the current article
    const articleCommand = new GetCommand({
      TableName: "articles",
      Key: { articleId: id },
    });

    const { Item: article } = await ddbDocClient.send(articleCommand);

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Increment view count
    const updateCommand = new UpdateCommand({
      TableName: "articles",
      Key: { articleId: id },
      UpdateExpression:
        "SET viewCount = if_not_exists(viewCount, :zero) + :inc",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":inc": 1,
      },
      ReturnValues: "ALL_NEW",
    });

    const { Attributes: updatedArticle } = await ddbDocClient.send(
      updateCommand
    );

    if (!updatedArticle) {
      return NextResponse.json(
        { error: "Failed to update view count" },
        { status: 500 }
      );
    }

    let authorName = "Unknown User";
    let authorPicture = null;

    try {
      const userCommand = new GetCommand({
        TableName: "users",
        Key: { userId: updatedArticle.userId },
      });

      const { Item: userItem } = await ddbDocClient.send(userCommand);

      if (userItem?.firstName && userItem?.lastName) {
        authorName = `${userItem.firstName} ${userItem.lastName}`;
        authorPicture = userItem.picture ?? null;
      }
    } catch {
      // Optional: log this failure
    }

    return NextResponse.json(
      { article: { ...updatedArticle, authorName, authorPicture } },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

// PUT - Update article
export async function PUT(
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

// DELETE - Delete article
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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