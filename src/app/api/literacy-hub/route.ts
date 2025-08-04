import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { verifyAuth } from "@/utils/auth";
import { PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { createArticleSchema } from "@/schema/articles";

// GET - Read all articles
export async function GET(req: NextRequest) {
  try {
    // Read all articles
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

// POST - Create new article
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
    const validationResult = createArticleSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.message },
        { status: 400 }
      );
    }

    // Ensure only the file name is stored for coverImage
    let coverImageFileName = undefined;
    if (body.coverImage) {
      // If it's a URL or path, extract the file name
      const parts = body.coverImage.split("/");
      coverImageFileName = parts[parts.length - 1];
    }
    console.log(coverImageFileName);
    

    // Prevent duplicate titles globally using GSI
    const queryCommand = new QueryCommand({
      TableName: "articles",
      IndexName: "title-index",
      KeyConditionExpression: "title = :title",
      ExpressionAttributeValues: { ":title": body.title },
      Limit: 1,
    });
    const { Items } = await ddbDocClient.send(queryCommand);
    if (Items && Items.length > 0) {
      return NextResponse.json(
        { error: "An article with this title already exists." },
        { status: 403 }
      );
    }

    const articleId = uuidv4();
    const userId = userPayload.userId;
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;
    const viewable = "ARTICLES";

    const newArticle = {
      articleId,
      userId,
      createdAt,
      updatedAt,
      viewable,
      ...body,
      coverImage: coverImageFileName,
    };

    const putArticleCommand = new PutCommand({
      TableName: "articles",
      Item: newArticle,
    });
    await ddbDocClient.send(putArticleCommand);

    return NextResponse.json(
      { message: "Article created successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 }
    );
  }
} 