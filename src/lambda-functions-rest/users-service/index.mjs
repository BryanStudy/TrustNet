import { verifyAuth, ddbDocClient } from "/opt/nodejs/index.js";
import {
  PutCommand,
  QueryCommand,
  ScanCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SignJWT } from "jose";
import { v4 as uuidv4 } from "uuid";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import AWSXRay from "aws-xray-sdk-core";

const allowedOrigins = ["http://localhost:3000", "http://localhost:8080"];

function getCorsOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  return allowedOrigins.includes(origin) ? origin : "";
}

const JWT_SECRET = process.env.JWT_SECRET;

// S3 client setup
const s3Client = AWSXRay.captureAWSv3Client(new S3Client({}));

// DynamoDB Setup
const tracedDdbDocClient = AWSXRay.captureAWSv3Client(ddbDocClient);

// S3 helper functions
function getBucketName() {
  const bucketName = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error(
      "NEXT_PUBLIC_S3_BUCKET_NAME environment variable is not set"
    );
  }
  return bucketName;
}

function constructS3Key(fileName, folderPath) {
  return folderPath
    ? `${folderPath.replace(/^\/+|\/+$/g, "")}/${fileName}`
    : fileName;
}

async function deleteFile(fileNameOrKey, folderPath) {
  const key = fileNameOrKey.includes("/")
    ? fileNameOrKey
    : constructS3Key(fileNameOrKey, folderPath);

  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  await s3Client.send(command);
}

// Simple email validation
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation
function validatePassword(password) {
  const errors = [];
  if (password.length < 8)
    errors.push("Password must be at least 8 characters");
  if (!/[0-9]/.test(password))
    errors.push("Password must contain at least 1 number");
  if (!/[a-z]/.test(password))
    errors.push("Password must contain at least 1 lowercase letter");
  if (!/[A-Z]/.test(password))
    errors.push("Password must contain at least 1 uppercase letter");
  if (!/[^A-Za-z0-9]/.test(password))
    errors.push("Password must contain at least 1 special character");
  return errors;
}

// User creation validation
function validateCreateUser(data) {
  const errors = [];

  if (!data.firstName || data.firstName.length < 1) {
    errors.push("First name is required");
  } else if (data.firstName.length > 50) {
    errors.push("First name too long");
  }

  if (!data.lastName || data.lastName.length < 1) {
    errors.push("Last name is required");
  } else if (data.lastName.length > 50) {
    errors.push("Last name too long");
  }

  if (!data.email || !validateEmail(data.email)) {
    errors.push("Invalid email format");
  }

  if (data.password) {
    const passwordErrors = validatePassword(data.password);
    errors.push(...passwordErrors);
  }

  if (!data.picture || data.picture.length < 1) {
    errors.push("Profile picture is required");
  }

  if (!data.role || !["customer", "admin"].includes(data.role)) {
    errors.push("Role must be either 'customer' or 'admin'");
  }

  return errors;
}

// User update validation
function validateUpdateUser(data) {
  const errors = [];

  if (data.firstName !== undefined) {
    if (!data.firstName || data.firstName.length < 1) {
      errors.push("First name is required");
    } else if (data.firstName.length > 50) {
      errors.push("First name too long");
    }
  }

  if (data.lastName !== undefined) {
    if (!data.lastName || data.lastName.length < 1) {
      errors.push("Last name is required");
    } else if (data.lastName.length > 50) {
      errors.push("Last name too long");
    }
  }

  if (data.email !== undefined && !validateEmail(data.email)) {
    errors.push("Invalid email format");
  }

  if (data.role !== undefined && !["customer", "admin"].includes(data.role)) {
    errors.push("Role must be either 'customer' or 'admin'");
  }

  return errors;
}

// Create user (POST /users)
async function handleCreateUser(event) {
  try {
    const body = JSON.parse(event.body || "{}");

    const validationErrors = validateCreateUser(body);
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

    const { firstName, lastName, email, password, picture, role } = body;

    // Check if user already exists
    const query = new QueryCommand({
      TableName: "users",
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email },
      Limit: 1,
    });
    const { Items } = await tracedDdbDocClient.send(query);

    if (Items && Items.length > 0) {
      return {
        statusCode: 409,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "User with this email already exists." }),
      };
    }

    // Store user
    const user = {
      userId: uuidv4(),
      email,
      firstName,
      lastName,
      password,
      picture,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await tracedDdbDocClient.send(
      new PutCommand({
        TableName: "users",
        Item: user,
      })
    );

    // Create JWT
    const jwt = await new SignJWT({
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      picture: user.picture,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(JWT_SECRET));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
        "Set-Cookie": `token=${jwt}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict;`,
      },
      body: JSON.stringify({ user: { ...user, password: undefined } }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("Error in create user endpoint:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: errorMessage }),
    };
  }
}

// Get all users (GET /users)
async function handleGetUsers(event) {
  try {
    // Check if user is authenticated and is admin
    const payload = await verifyAuth(event);
    if (!payload) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // Only admins can list all users
    if (payload.role !== "admin") {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    // Get all users with scan
    const command = new ScanCommand({
      TableName: "users",
      ProjectionExpression:
        "userId, firstName, lastName, email, #r, picture, createdAt, updatedAt",
      ExpressionAttributeNames: {
        "#r": "role",
      },
    });

    const { Items: users = [] } = await tracedDdbDocClient.send(command);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ users }),
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to fetch users" }),
    };
  }
}

// Admin create user (POST /users/admin-create)
async function handleAdminCreateUser(event) {
  try {
    // Check if user is authenticated and is admin
    const payload = await verifyAuth(event);
    if (!payload || payload.role !== "admin") {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    const validationErrors = validateCreateUser(body);
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

    const { firstName, lastName, email, password, picture, role } = body;

    // Check if user already exists
    const query = new QueryCommand({
      TableName: "users",
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email },
      Limit: 1,
    });
    const { Items } = await tracedDdbDocClient.send(query);
    if (Items && Items.length > 0) {
      return {
        statusCode: 409,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "User with this email already exists." }),
      };
    }

    // Store user
    const user = {
      userId: uuidv4(),
      email,
      firstName,
      lastName,
      password,
      picture,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await tracedDdbDocClient.send(
      new PutCommand({
        TableName: "users",
        Item: user,
      })
    );

    // Return user info (excluding password)
    const { password: _pw, ...userWithoutPassword } = user;
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ user: userWithoutPassword }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("Error in admin-create user endpoint:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: errorMessage }),
    };
  }
}

// Get user by ID (GET /users/{id})
async function handleGetUser(event) {
  try {
    const userId = event.pathParameters?.id;
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "User ID is required" }),
      };
    }

    // Check if user is authenticated
    const payload = await verifyAuth(event);
    if (!payload) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // Only admins can view user details (or users viewing their own profile)
    if (payload.role !== "admin" && payload.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    const command = new GetCommand({
      TableName: "users",
      Key: { userId },
    });

    const { Item: user } = await tracedDdbDocClient.send(command);

    if (!user) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ user: userWithoutPassword }),
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to fetch user" }),
    };
  }
}

// Update user (PATCH /users/{id})
async function handleUpdateUser(event) {
  try {
    const userId = event.pathParameters?.id;
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "User ID is required" }),
      };
    }

    // Authenticate user
    const payload = await verifyAuth(event);
    if (!payload) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Not authenticated" }),
      };
    }

    // Only admins can update any user, or users can update their own profile
    if (payload.role !== "admin" && payload.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    const validationErrors = validateUpdateUser(body);
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

    const updates = body;

    // Build update expression dynamically
    const updateExpr = [];
    const exprAttrNames = {};
    const exprAttrValues = {};

    if (updates.firstName !== undefined) {
      updateExpr.push("firstName = :firstName");
      exprAttrValues[":firstName"] = updates.firstName;
    }

    if (updates.lastName !== undefined) {
      updateExpr.push("lastName = :lastName");
      exprAttrValues[":lastName"] = updates.lastName;
    }

    if (updates.email !== undefined) {
      updateExpr.push("email = :email");
      exprAttrValues[":email"] = updates.email;
    }

    if (updates.role !== undefined) {
      updateExpr.push("#r = :role");
      exprAttrNames["#r"] = "role";
      exprAttrValues[":role"] = updates.role;
    }

    if (updates.picture !== undefined) {
      updateExpr.push("picture = :picture");
      exprAttrValues[":picture"] = updates.picture;
    }

    // Always update the updatedAt timestamp
    updateExpr.push("updatedAt = :updatedAt");
    exprAttrValues[":updatedAt"] = new Date().toISOString();

    if (updateExpr.length === 1) {
      // Only updatedAt
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "No fields to update" }),
      };
    }

    const command = new UpdateCommand({
      TableName: "users",
      Key: { userId },
      UpdateExpression: `SET ${updateExpr.join(", ")}`,
      ExpressionAttributeNames:
        Object.keys(exprAttrNames).length > 0 ? exprAttrNames : undefined,
      ExpressionAttributeValues: exprAttrValues,
      ReturnValues: "ALL_NEW",
    });

    const { Attributes } = await tracedDdbDocClient.send(command);

    if (!Attributes) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = Attributes;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        message: "User updated successfully",
        user: userWithoutPassword,
      }),
    };
  } catch (error) {
    console.error("Failed to update user:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to update user" }),
    };
  }
}

// Delete user (DELETE /users/{id})
async function handleDeleteUser(event) {
  try {
    const userId = event.pathParameters?.id;
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "User ID is required" }),
      };
    }

    // Authenticate user
    const payload = await verifyAuth(event);
    if (!payload) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Not authenticated" }),
      };
    }

    // Only admins can delete users
    if (payload.role !== "admin") {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Forbidden - Admin access required" }),
      };
    }

    // First, check if user exists
    const getUserCommand = new GetCommand({
      TableName: "users",
      Key: { userId },
    });
    const { Item: user } = await tracedDdbDocClient.send(getUserCommand);

    if (!user) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    // Delete user's profile picture from S3 if it exists
    if (user.picture) {
      try {
        await deleteFile(user.picture, "profile-pictures");
      } catch (err) {
        console.error("Failed to delete profile picture:", err);
      }
    }

    // 1. Delete from digital-threats table (where submittedBy = userId)
    const threatsCommand = new ScanCommand({
      TableName: "digital-threats",
      FilterExpression: "submittedBy = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    });
    const { Items: threats = [] } = await tracedDdbDocClient.send(
      threatsCommand
    );

    // Collect likes for each threatId (orphan likes)
    let orphanThreatLikes = [];
    for (const threat of threats) {
      if (!threat.threatId) continue;
      // Query threat-likes by threatId using the GSI
      const threatLikesQuery = new QueryCommand({
        TableName: "threat-likes",
        IndexName: "threatId-index",
        KeyConditionExpression: "threatId = :threatId",
        ExpressionAttributeValues: { ":threatId": threat.threatId },
      });
      const { Items: threatLikes = [] } = await tracedDdbDocClient.send(
        threatLikesQuery
      );
      orphanThreatLikes.push(...threatLikes);
    }

    // 2. Delete from threat-likes table (where userId = userId)
    const likesCommand = new QueryCommand({
      TableName: "threat-likes",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    });
    const { Items: likes = [] } = await tracedDdbDocClient.send(likesCommand);

    // 3. Delete from articles table (where userId = userId)
    const articlesCommand = new ScanCommand({
      TableName: "articles",
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    });
    const { Items: articles = [] } = await tracedDdbDocClient.send(
      articlesCommand
    );

    // 4. Delete from scam-reports table (where userId = userId)
    const reportsCommand = new ScanCommand({
      TableName: "scam-reports",
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    });
    const { Items: reports = [] } = await tracedDdbDocClient.send(
      reportsCommand
    );

    // Prepare batch delete operations
    const deleteRequests = [];

    // Add threats to delete
    threats.forEach((threat) => {
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            threatId: threat.threatId,
            createdAt: threat.createdAt,
          },
        },
      });
    });

    // Add likes to delete (user's own likes)
    likes.forEach((like) => {
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            userId: like.userId,
            threatId: like.threatId,
          },
        },
      });
    });

    // Add orphan likes to delete (likes on user's threats by others)
    orphanThreatLikes.forEach((like) => {
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            userId: like.userId,
            threatId: like.threatId,
          },
        },
      });
    });

    // Add articles to delete (and their cover images)
    for (const article of articles) {
      if (article.coverImage) {
        try {
          await deleteFile(article.coverImage, "article-images");
        } catch (err) {
          console.error("Failed to delete article image:", err);
        }
      }
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            articleId: article.articleId,
          },
        },
      });
    }

    // Add reports to delete (and their images)
    for (const report of reports) {
      if (report.image) {
        try {
          await deleteFile(report.image, "scam-reports");
        } catch (err) {
          console.error("Failed to delete report image:", err);
        }
      }
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            reportId: report.reportId,
            createdAt: report.createdAt,
          },
        },
      });
    }

    // Execute batch deletes in chunks (DynamoDB limit is 25 items per batch)
    const chunkSize = 25;
    for (let i = 0; i < deleteRequests.length; i += chunkSize) {
      const chunk = deleteRequests.slice(i, i + chunkSize);

      // Group by table
      const requestItems = {};

      chunk.forEach((request) => {
        // Determine table based on key structure
        if (
          request.DeleteRequest.Key.threatId &&
          request.DeleteRequest.Key.createdAt
        ) {
          if (!requestItems["digital-threats"])
            requestItems["digital-threats"] = [];
          requestItems["digital-threats"].push(request);
        } else if (
          request.DeleteRequest.Key.userId &&
          request.DeleteRequest.Key.threatId
        ) {
          if (!requestItems["threat-likes"]) requestItems["threat-likes"] = [];
          requestItems["threat-likes"].push(request);
        } else if (request.DeleteRequest.Key.articleId) {
          if (!requestItems["articles"]) requestItems["articles"] = [];
          requestItems["articles"].push(request);
        } else if (request.DeleteRequest.Key.reportId) {
          if (!requestItems["scam-reports"]) requestItems["scam-reports"] = [];
          requestItems["scam-reports"].push(request);
        }
      });

      if (Object.keys(requestItems).length > 0) {
        const batchCommand = new BatchWriteCommand({
          RequestItems: requestItems,
        });
        await tracedDdbDocClient.send(batchCommand);
      }
    }

    // Finally, delete the user
    const deleteUserCommand = new DeleteCommand({
      TableName: "users",
      Key: { userId },
    });
    await tracedDdbDocClient.send(deleteUserCommand);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        message: "User and all associated data deleted successfully",
      }),
    };
  } catch (error) {
    console.error("Failed to delete user:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Failed to delete user" }),
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
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
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

    // Route: POST /users
    if (event.resource === "/users" && event.httpMethod === "POST") {
      const response = await handleCreateUser(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: GET /users
    if (event.resource === "/users" && event.httpMethod === "GET") {
      const response = await handleGetUsers(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: POST /users/admin-create
    if (
      event.resource === "/users/admin-create" &&
      event.httpMethod === "POST"
    ) {
      const response = await handleAdminCreateUser(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: GET /users/{id}
    if (event.resource === "/users/{id}" && event.httpMethod === "GET") {
      const response = await handleGetUser(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: PATCH /users/{id}
    if (event.resource === "/users/{id}" && event.httpMethod === "PATCH") {
      const response = await handleUpdateUser(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: DELETE /users/{id}
    if (event.resource === "/users/{id}" && event.httpMethod === "DELETE") {
      const response = await handleDeleteUser(event);
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
