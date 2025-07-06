import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { verifyAuth } from "@/utils/auth";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { createArticleSchema } from "@/schema/articles";

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