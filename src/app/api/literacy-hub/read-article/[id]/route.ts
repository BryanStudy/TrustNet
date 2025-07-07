// File: src/app/api/literacy-hub/read-article/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "articleId is required." }, { status: 400 });
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
      UpdateExpression: "SET viewCount = if_not_exists(viewCount, :zero) + :inc",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":inc": 1
      },
      ReturnValues: "ALL_NEW"
    });

    const { Attributes: updatedArticle } = await ddbDocClient.send(updateCommand);

    if (!updatedArticle) {
      return NextResponse.json({ error: "Failed to update view count" }, { status: 500 });
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
    return NextResponse.json({ error: "Failed to fetch article" }, { status: 500 });
  }
}
