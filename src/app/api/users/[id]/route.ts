import { NextRequest, NextResponse } from 'next/server';
import { UpdateCommand, GetCommand, DeleteCommand, ScanCommand, BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import ddbDocClient from '@/utils/dynamodb';
import { verifyAuth } from '@/utils/auth';
import { z } from 'zod';

// User update validation schema
const updateUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name too long").optional(),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name too long").optional(),
  email: z.string().email("Invalid email format").optional(),
  role: z.enum(["customer", "admin"], {
    errorMap: () => ({ message: "Role must be either 'customer' or 'admin'" }),
  }).optional(),
  picture: z.string().optional(),
});

/**
 * Handles fetching a single user by ID.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check if user is authenticated and is admin
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only admins can view user details (or users viewing their own profile)
    if (payload.role !== "admin" && payload.userId !== params.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const command = new GetCommand({
      TableName: 'users',
      Key: { userId: params.id },
    });

    const { Item: user } = await ddbDocClient.send(command);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

/**
 * Handles updating user information in DynamoDB.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authenticate user
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only admins can update any user, or users can update their own profile
    if (payload.role !== "admin" && payload.userId !== params.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const userId = params.id;
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required in params' }, { status: 400 });
    }

    const body = await req.json();
    
    // Validate incoming data
    const validationResult = updateUserSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => err.message).join(', ');
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const updates = validationResult.data;
    
    // Build update expression dynamically
    const updateExpr: string[] = [];
    const exprAttrNames: Record<string, string> = {};
    const exprAttrValues: Record<string, any> = {};

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

    if (updateExpr.length === 1) { // Only updatedAt
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const command = new UpdateCommand({
      TableName: 'users',
      Key: { userId },
      UpdateExpression: `SET ${updateExpr.join(", ")}`,
      ExpressionAttributeNames: Object.keys(exprAttrNames).length > 0 ? exprAttrNames : undefined,
      ExpressionAttributeValues: exprAttrValues,
      ReturnValues: 'ALL_NEW',
    });

    const { Attributes } = await ddbDocClient.send(command);
    
    if (!Attributes) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = Attributes;
    
    return NextResponse.json({ message: 'User updated successfully', user: userWithoutPassword });
  } catch (err) {
    console.error('Failed to update user:', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * Handles deleting a user and all associated records.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authenticate user
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only admins can delete users
    if (payload.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const userId = params.id;
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required in params' }, { status: 400 });
    }

    // First, check if user exists
    const getUserCommand = new GetCommand({
      TableName: 'users',
      Key: { userId },
    });
    const { Item: user } = await ddbDocClient.send(getUserCommand);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete user's profile picture from S3 if it exists
    if (user.picture) {
      try {
        await fetch("/api/s3", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: user.picture,
            folderPath: "profile-pictures",
          }),
        });
      } catch (err) {
        console.error("Failed to delete profile picture:", err);
        // Continue with deletion even if S3 cleanup fails
      }
    }

    // 1. Delete from digital-threats table (where submittedBy = userId)
    const threatsCommand = new ScanCommand({
      TableName: 'digital-threats',
      FilterExpression: 'submittedBy = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    });
    const { Items: threats = [] } = await ddbDocClient.send(threatsCommand);

    // 2. Delete from threat-likes table (where userId = userId)
    const likesCommand = new QueryCommand({
      TableName: 'threat-likes',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    });
    const { Items: likes = [] } = await ddbDocClient.send(likesCommand);

    // 3. Delete from articles table (where userId = userId)
    const articlesCommand = new ScanCommand({
      TableName: 'articles',
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    });
    const { Items: articles = [] } = await ddbDocClient.send(articlesCommand);

    // 4. Delete from scam-reports table (where userId = userId)
    const reportsCommand = new ScanCommand({
      TableName: 'scam-reports',
      FilterExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    });
    const { Items: reports = [] } = await ddbDocClient.send(reportsCommand);

    // Prepare batch delete operations
    const deleteRequests: any[] = [];

    // Add threats to delete
    threats.forEach(threat => {
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            threatId: threat.threatId,
            createdAt: threat.createdAt
          }
        }
      });
    });

    // Add likes to delete
    likes.forEach(like => {
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            userId: like.userId,
            threatId: like.threatId
          }
        }
      });
    });

    // Add articles to delete (and their cover images)
    for (const article of articles) {
      if (article.coverImage) {
        try {
          await fetch("/api/s3", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              key: article.coverImage,
              folderPath: "article-images",
            }),
          });
        } catch (err) {
          console.error("Failed to delete article image:", err);
        }
      }
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            articleId: article.articleId
          }
        }
      });
    }

    // Add reports to delete (and their images)
    for (const report of reports) {
      if (report.image) {
        try {
          await fetch("/api/s3", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              key: report.image,
              folderPath: "scam-reports", // Assuming this folder path
            }),
          });
        } catch (err) {
          console.error("Failed to delete report image:", err);
        }
      }
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            reportId: report.reportId,
            createdAt: report.createdAt
          }
        }
      });
    }

    // Execute batch deletes in chunks (DynamoDB limit is 25 items per batch)
    const chunkSize = 25;
    for (let i = 0; i < deleteRequests.length; i += chunkSize) {
      const chunk = deleteRequests.slice(i, i + chunkSize);
      
      // Group by table
      const requestItems: any = {};
      
      chunk.forEach(request => {
        // Determine table based on key structure
        if (request.DeleteRequest.Key.threatId && request.DeleteRequest.Key.createdAt) {
          if (!requestItems['digital-threats']) requestItems['digital-threats'] = [];
          requestItems['digital-threats'].push(request);
        } else if (request.DeleteRequest.Key.userId && request.DeleteRequest.Key.threatId) {
          if (!requestItems['threat-likes']) requestItems['threat-likes'] = [];
          requestItems['threat-likes'].push(request);
        } else if (request.DeleteRequest.Key.articleId) {
          if (!requestItems['articles']) requestItems['articles'] = [];
          requestItems['articles'].push(request);
        } else if (request.DeleteRequest.Key.reportId) {
          if (!requestItems['scam-reports']) requestItems['scam-reports'] = [];
          requestItems['scam-reports'].push(request);
        }
      });

      if (Object.keys(requestItems).length > 0) {
        const batchCommand = new BatchWriteCommand({
          RequestItems: requestItems
        });
        await ddbDocClient.send(batchCommand);
      }
    }

    // Finally, delete the user
    const deleteUserCommand = new DeleteCommand({
      TableName: 'users',
      Key: { userId },
    });
    await ddbDocClient.send(deleteUserCommand);

    return NextResponse.json({ message: 'User and all associated data deleted successfully' });
  } catch (err) {
    console.error('Failed to delete user:', err);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
} 