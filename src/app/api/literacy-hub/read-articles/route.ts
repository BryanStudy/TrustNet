import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";

export async function GET(req: NextRequest) {
  try {
    const command = new QueryCommand({
      TableName: "articles",
      IndexName: "viewable-createdAt-index",
      KeyConditionExpression: "viewable = :viewable",
      ExpressionAttributeValues: { ":viewable": "ARTICLES" },
      ScanIndexForward: false, // newest first
    });
    const { Items } = await ddbDocClient.send(command);
    const articles = Items || [];

    // Fetch user info for each article
    const articlesWithAuthor = await Promise.all(
      articles.map(async (article) => {
        let authorName = "Unknown User";
        let authorPicture = null;
        try {
          const userCommand = new GetCommand({
            TableName: "users",
            Key: { userId: article.userId },
          });
          const { Item: userItem } = await ddbDocClient.send(userCommand);
          if (userItem && userItem.firstName && userItem.lastName) {
            authorName = `${userItem.firstName} ${userItem.lastName}`;
            authorPicture = userItem.picture || null;
          }
        } catch (userError) {
          // If user fetch fails, keep fallback
        }
        return {
          ...article,
          authorName,
          authorPicture,
        };
      })
    );

    return NextResponse.json({ articles: articlesWithAuthor }, { status: 200 });
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
  }
} 