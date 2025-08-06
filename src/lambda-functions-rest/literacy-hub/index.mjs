import { verifyAuth, ddbDocClient } from "/opt/nodejs/index.js";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import AWSXRay from "aws-xray-sdk-core";

const allowedOrigins = ["http://localhost:3000", "http://localhost:8080"];

// X-Ray SDK initialization
const tracedDdbDocClient = AWSXRay.captureAWSv3Client(ddbDocClient);

function getCorsOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  return allowedOrigins.includes(origin) ? origin : "";
}

// Article validation functions
function validateCreateArticle(data) {
  const errors = [];

  if (!data.title || data.title.length < 1) {
    errors.push("Title is required");
  } else if (data.title.length > 200) {
    errors.push("Title too long");
  }

  if (!data.content || data.content.length < 1) {
    errors.push("Content is required");
  }

  if (!data.category || data.category.length < 1) {
    errors.push("Category is required");
  }

  if (!data.readTime || data.readTime < 1) {
    errors.push("Read time must be at least 1 minute");
  }

  if (!data.coverImage || data.coverImage.length < 1) {
    errors.push("Cover image is required");
  }

  return errors;
}

function validateUpdateArticle(data) {
  const errors = [];

  if (data.title !== undefined) {
    if (!data.title || data.title.length < 1) {
      errors.push("Title is required");
    } else if (data.title.length > 200) {
      errors.push("Title too long");
    }
  }

  if (
    data.content !== undefined &&
    (!data.content || data.content.length < 1)
  ) {
    errors.push("Content is required");
  }

  if (
    data.category !== undefined &&
    (!data.category || data.category.length < 1)
  ) {
    errors.push("Category is required");
  }

  if (data.readTime !== undefined && data.readTime < 1) {
    errors.push("Read time must be at least 1 minute");
  }

  if (
    data.coverImage !== undefined &&
    (!data.coverImage || data.coverImage.length < 1)
  ) {
    errors.push("Cover image is required");
  }

  return errors;
}

// Create article (POST /literacy-hub)
async function handleCreateArticle(event) {
  try {
    // Check if user is authenticated
    const userPayload = await verifyAuth(event);
    if (!userPayload) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "User is not authenticated" }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    const validationErrors = validateCreateArticle(body);
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: validationErrors.join(", ") }),
      };
    }

    // Ensure only the file name is stored for coverImage
    let coverImageFileName = undefined;
    if (body.coverImage) {
      // If it's a URL or path, extract the file name
      const parts = body.coverImage.split("/");
      coverImageFileName = parts[parts.length - 1];
    }

    // Prevent duplicate titles globally using GSI
    const queryCommand = new QueryCommand({
      TableName: "articles",
      IndexName: "title-index",
      KeyConditionExpression: "title = :title",
      ExpressionAttributeValues: { ":title": body.title },
      Limit: 1,
    });
    const { Items } = await tracedDdbDocClient.send(queryCommand);
    if (Items && Items.length > 0) {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          error: "An article with this title already exists.",
        }),
      };
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
    await tracedDdbDocClient.send(putArticleCommand);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ message: "Article created successfully" }),
    };
  } catch (error) {
    console.error("Error creating article:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to create article" }),
    };
  }
}

// Read all articles (GET /literacy-hub)
async function handleReadArticles(event) {
  try {
    const command = new QueryCommand({
      TableName: "articles",
      IndexName: "viewable-createdAt-index",
      KeyConditionExpression: "viewable = :viewable",
      ExpressionAttributeValues: { ":viewable": "ARTICLES" },
      ScanIndexForward: false, // newest first
    });
    const { Items } = await tracedDdbDocClient.send(command);
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
          const { Item: userItem } = await tracedDdbDocClient.send(userCommand);
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

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ articles: articlesWithAuthor }),
    };
  } catch (error) {
    console.error("Error fetching articles:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to fetch articles" }),
    };
  }
}

// Read single article (GET /literacy-hub/{id})
async function handleReadArticle(event) {
  try {
    const articleId = event.pathParameters?.id;

    if (!articleId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "articleId is required." }),
      };
    }

    // First get the current article
    const articleCommand = new GetCommand({
      TableName: "articles",
      Key: { articleId },
    });

    const { Item: article } = await tracedDdbDocClient.send(articleCommand);

    if (!article) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Article not found" }),
      };
    }

    // Increment view count
    const updateCommand = new UpdateCommand({
      TableName: "articles",
      Key: { articleId },
      UpdateExpression:
        "SET viewCount = if_not_exists(viewCount, :zero) + :inc",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":inc": 1,
      },
      ReturnValues: "ALL_NEW",
    });

    const { Attributes: updatedArticle } = await tracedDdbDocClient.send(
      updateCommand
    );

    if (!updatedArticle) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Failed to update view count" }),
      };
    }

    let authorName = "Unknown User";
    let authorPicture = null;

    try {
      const userCommand = new GetCommand({
        TableName: "users",
        Key: { userId: updatedArticle.userId },
      });

      const { Item: userItem } = await tracedDdbDocClient.send(userCommand);

      if (userItem?.firstName && userItem?.lastName) {
        authorName = `${userItem.firstName} ${userItem.lastName}`;
        authorPicture = userItem.picture ?? null;
      }
    } catch {
      // Optional: log this failure
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        article: { ...updatedArticle, authorName, authorPicture },
      }),
    };
  } catch (error) {
    console.error("Error fetching article:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to fetch article" }),
    };
  }
}

// Update article (PUT /literacy-hub/{id})
async function handleUpdateArticle(event) {
  try {
    const articleId = event.pathParameters?.id;
    if (!articleId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Article ID is required" }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    // Validate input using the update schema
    const validationErrors = validateUpdateArticle(body);
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: validationErrors.join(" | ") }),
      };
    }

    // Get the existing article first
    const getCommand = new GetCommand({
      TableName: "articles",
      Key: { articleId },
    });
    const { Item: existingArticle } = await tracedDdbDocClient.send(getCommand);
    if (!existingArticle) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Article not found" }),
      };
    }

    // Build update expression
    const allowedFields = [
      "title",
      "content",
      "category",
      "readTime",
      "coverImage",
    ];
    const updateFields = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateFields[key] = body[key];
    }
    if (Object.keys(updateFields).length === 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "No valid fields to update" }),
      };
    }

    // Build UpdateExpression
    const updateExpr = [];
    const exprAttrNames = {};
    const exprAttrValues = {};
    for (const key of Object.keys(updateFields)) {
      updateExpr.push(`#${key} = :${key}`);
      exprAttrNames[`#${key}`] = key;
      exprAttrValues[`:${key}`] = updateFields[key];
    }
    exprAttrNames["#updatedAt"] = "updatedAt";
    exprAttrValues[":updatedAt"] = new Date().toISOString();
    updateExpr.push("#updatedAt = :updatedAt");

    const command = new UpdateCommand({
      TableName: "articles",
      Key: { articleId },
      UpdateExpression: `SET ${updateExpr.join(", ")}`,
      ExpressionAttributeNames: exprAttrNames,
      ExpressionAttributeValues: exprAttrValues,
      ReturnValues: "ALL_NEW",
    });

    const { Attributes: updated } = await tracedDdbDocClient.send(command);
    if (!updated) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Article not found after update" }),
      };
    }

    // Fetch author info
    let authorName = "Unknown User";
    let authorPicture = null;
    try {
      const userCommand = new GetCommand({
        TableName: "users",
        Key: { userId: updated.userId },
      });
      const { Item: userItem } = await tracedDdbDocClient.send(userCommand);
      if (userItem && userItem.firstName && userItem.lastName) {
        authorName = `${userItem.firstName} ${userItem.lastName}`;
        authorPicture = userItem.picture || null;
      }
    } catch {}

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        article: { ...updated, authorName, authorPicture },
      }),
    };
  } catch (error) {
    console.error("Error updating article:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to update article" }),
    };
  }
}

// Delete article (DELETE /literacy-hub/{id})
async function handleDeleteArticle(event) {
  try {
    const articleId = event.pathParameters?.id;
    if (!articleId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Article ID is required" }),
      };
    }

    const command = new DeleteCommand({
      TableName: "articles",
      Key: { articleId },
    });
    await tracedDdbDocClient.send(command);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ message: "Article deleted successfully" }),
    };
  } catch (error) {
    console.error("Error deleting article:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to delete article" }),
    };
  }
}

// Main Lambda handler
export const handler = async (event) => {
  console.log("EVENT:", JSON.stringify(event));

  const corsHeaders = {
    "Access-Control-Allow-Origin": getCorsOrigin(event),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  };

  try {
    // CORS Preflight (OPTIONS request)
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: "CORS preflight successful" }),
      };
    }

    // Route: POST /literacy-hub
    if (event.resource === "/literacy-hub" && event.httpMethod === "POST") {
      const response = await handleCreateArticle(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: GET /literacy-hub
    if (event.resource === "/literacy-hub" && event.httpMethod === "GET") {
      const response = await handleReadArticles(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: GET /literacy-hub/{id}
    if (event.resource === "/literacy-hub/{id}" && event.httpMethod === "GET") {
      const response = await handleReadArticle(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: PUT /literacy-hub/{id}
    if (event.resource === "/literacy-hub/{id}" && event.httpMethod === "PUT") {
      const response = await handleUpdateArticle(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: DELETE /literacy-hub/{id}
    if (
      event.resource === "/literacy-hub/{id}" &&
      event.httpMethod === "DELETE"
    ) {
      const response = await handleDeleteArticle(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Unknown route
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        error: `Unsupported route: ${event.resource} ${event.httpMethod}`,
      }),
    };
  } catch (err) {
    console.error("ERROR:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
