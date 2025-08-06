import { verifyAuth, ddbDocClient } from "/opt/nodejs/index.js";
import {
  QueryCommand,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  SNSClient,
  SubscribeCommand,
  PublishCommand,
} from "@aws-sdk/client-sns";
import { v4 as uuidv4 } from "uuid";
import AWSXRay from "aws-xray-sdk-core";

const allowedOrigins = ["http://localhost:3000", "http://localhost:8080"];

function getCorsOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  return allowedOrigins.includes(origin) ? origin : "";
}

// AWS SNS Configuration
const snsClient = new SNSClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});
const TOPIC_ARN = process.env.AWS_SNS_TOPIC_ARN;

// AWS XRAY Configuration
const tracedDdbDocClient = AWSXRay.captureAWSv3Client(ddbDocClient);
const tracedSnsClient = AWSXRay.captureAWSv3Client(snsClient);

if (!TOPIC_ARN) {
  console.error("AWS_SNS_TOPIC_ARN environment variable is not set");
}

// Table names
const DIGITAL_THREATS_TABLE = "digital-threats";
const THREAT_LIKES_TABLE = "threat-likes";
const USERS_TABLE = "users";

// Schema validation
const validateCreateThreat = (data) => {
  const required = ["artifact", "type", "description"];
  const validTypes = ["url", "email", "phone"];

  for (const field of required) {
    if (
      !data[field] ||
      typeof data[field] !== "string" ||
      data[field].trim() === ""
    ) {
      console.error(`Validation error: ${field} is required`);
      throw new Error(`${field} is required`);
    }
  }

  if (!validTypes.includes(data.type)) {
    console.error("Validation error: type must be url, email, or phone");
    throw new Error("Type must be url, email, or phone");
  }

  return true;
};

// SNS Utility Functions
/**
 * Auto-subscribe user to threat verification notifications
 * Called on every threat creation - SNS handles duplicates gracefully
 */
const autoSubscribeUser = async (email) => {
  if (!TOPIC_ARN) {
    console.error("Cannot auto-subscribe: AWS_SNS_TOPIC_ARN not configured");
    return;
  }

  try {
    console.log(`🔃 Attempting to subscribe ${email} to topic: ${TOPIC_ARN}`);
    const subscribeCommand = new SubscribeCommand({
      TopicArn: TOPIC_ARN,
      Protocol: "email",
      Endpoint: email,
    });

    const result = await tracedSnsClient.send(subscribeCommand);
    console.log(
      `✅ Auto-subscribed ${email}. Response:`,
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    console.error("❌ Error auto-subscribing user:", error);
  }
};

/**
 * Send threat verification notification (always try to send)
 * SNS will only deliver to confirmed subscribers
 */
const sendVerificationNotification = async (threatId, createdAt) => {
  if (!TOPIC_ARN) {
    console.error("Cannot send notification: AWS_SNS_TOPIC_ARN not configured");
    return;
  }

  try {
    // Get threat details
    const threatCommand = new GetCommand({
      TableName: DIGITAL_THREATS_TABLE,
      Key: { threatId, createdAt },
    });

    const threatResult = await tracedDdbDocClient.send(threatCommand);
    if (!threatResult.Item) {
      console.error(`Threat not found: ${threatId}`);
      throw new Error(`Threat not found: ${threatId}`);
    }

    const threat = threatResult.Item;

    // Get user details
    const userCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: threat.submittedBy },
    });

    const userResult = await tracedDdbDocClient.send(userCommand);
    if (!userResult.Item) {
      console.error(`User not found: ${threat.submittedBy}`);
      throw new Error(`User not found: ${threat.submittedBy}`);
    }

    const user = userResult.Item;

    // Simplified email template (no custom unsubscribe)
    const subject = "✅ Your TrustNet threat report has been verified";
    const message = `Hi ${user.firstName},

Great news! Your digital threat report has been verified by our admin team.

Threat Details:
📋 Artifact: ${threat.artifact}
🔗 Type: ${threat.type.toUpperCase()}
📝 Description: ${threat.description}
✅ Status: Verified

Your contribution helps keep our community safe from digital threats!

Best regards,
The TrustNet Team`;

    console.log(`🔃 Attempting to publish to topic: ${TOPIC_ARN}`);
    console.log(`Message subject: ${subject}`);

    // Always try to send - SNS handles delivery to confirmed subscribers only
    const publishCommand = new PublishCommand({
      TopicArn: TOPIC_ARN,
      Subject: subject,
      Message: message,
      MessageAttributes: {
        threatId: {
          DataType: "String",
          StringValue: threatId,
        },
        userId: {
          DataType: "String",
          StringValue: threat.submittedBy,
        },
        email: {
          DataType: "String",
          StringValue: user.email,
        },
      },
    });

    const result = await tracedSnsClient.send(publishCommand);
    console.log(
      `✅ Notification sent. Response:`,
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    // Don't throw - verification should succeed even if notification fails
    console.error("❌ Error sending verification notification:", error);
  }
};

// Threat creation
const createThreat = async (event) => {
  const userPayload = await verifyAuth(event);
  const body = JSON.parse(event.body);

  // Validate input
  validateCreateThreat(body);

  // Check if artifact already exists
  const findArtifactCommand = new QueryCommand({
    TableName: DIGITAL_THREATS_TABLE,
    IndexName: "artifact-createdAt-index",
    KeyConditionExpression: "artifact = :artifact",
    ExpressionAttributeValues: { ":artifact": body.artifact },
    Limit: 1,
  });

  const { Items } = await tracedDdbDocClient.send(findArtifactCommand);
  if (Items && Items.length > 0) {
    console.error("Artifact already exists:", body.artifact);
    throw new Error("Artifact already exists");
  }

  const threatId = uuidv4();
  const submittedBy = userPayload.userId;
  const createdAt = new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const status = "unverified";
  const likes = 0;

  const newThreat = {
    threatId,
    submittedBy,
    createdAt,
    updatedAt,
    status,
    likes,
    ...body,
    viewable: "THREATS",
  };

  const putCommand = new PutCommand({
    TableName: DIGITAL_THREATS_TABLE,
    Item: newThreat,
  });

  await tracedDdbDocClient.send(putCommand);

  // Auto-subscribe user to notifications (don't await - don't block response)
  console.log(
    `🔃 Attempting to auto-subscribe user ${userPayload.email} to topic: ${TOPIC_ARN}`
  );
  if (userPayload.email) {
    autoSubscribeUser(userPayload.email).catch((error) => {
      console.error("❌ Auto-subscribe failed:", error);
    });
  }

  return {
    message: "Digital threat created successfully",
    threatId: threatId,
  };
};

// Get all threats
const getAllThreats = async (event) => {
  await verifyAuth(event);

  const command = new QueryCommand({
    TableName: DIGITAL_THREATS_TABLE,
    IndexName: "viewable-createdAt-index",
    KeyConditionExpression: "viewable = :threats",
    ExpressionAttributeValues: {
      ":threats": "THREATS",
    },
    ScanIndexForward: false, // newest first
    Limit: 50,
  });

  const { Items } = await tracedDdbDocClient.send(command);

  return {
    threats: Items || [],
  };
};

// Get single threat by ID
const getThreatById = async (event) => {
  await verifyAuth(event);

  const threatId = event.pathParameters.id;
  const body = JSON.parse(event.body);
  const { createdAt } = body;

  if (!createdAt || typeof createdAt !== "string") {
    console.error(
      "Validation error: createdAt is required and must be a string"
    );
    throw new Error("createdAt is required and must be a string");
  }

  // Fetch the threat
  const threatCommand = new GetCommand({
    TableName: DIGITAL_THREATS_TABLE,
    Key: { threatId, createdAt },
  });

  const { Item: threatItem } = await tracedDdbDocClient.send(threatCommand);

  if (!threatItem) {
    console.error("Threat not found:", threatId);
    throw new Error("Threat not found");
  }

  // Fetch user details
  let reporterName = "Unknown User";
  try {
    const userCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: threatItem.submittedBy },
    });
    const { Item: userItem } = await tracedDdbDocClient.send(userCommand);

    if (userItem && userItem.firstName && userItem.lastName) {
      reporterName = `${userItem.firstName} ${userItem.lastName}`;
    }
  } catch (userError) {
    console.error("Failed to fetch user:", userError);
  }

  return {
    threat: threatItem,
    reporterName,
  };
};

// Update threat
const updateThreat = async (event) => {
  await verifyAuth(event);

  const threatId = event.pathParameters.id;
  const body = JSON.parse(event.body);
  const { createdAt } = body;

  if (!createdAt || typeof createdAt !== "string") {
    console.error(
      "Validation error: createdAt is required and must be a string"
    );
    throw new Error("createdAt is required and must be a string");
  }

  // Fetch existing item
  const getCmd = new GetCommand({
    TableName: DIGITAL_THREATS_TABLE,
    Key: { threatId, createdAt },
  });

  const { Item: existing } = await tracedDdbDocClient.send(getCmd);
  if (!existing) {
    console.error("Threat not found:", threatId);
    throw new Error("Threat not found");
  }

  // Merge fields
  const { artifact, type, description } = body;
  const updatedAt = new Date().toISOString();

  const updateCmd = new UpdateCommand({
    TableName: DIGITAL_THREATS_TABLE,
    Key: { threatId, createdAt },
    UpdateExpression:
      "set artifact = :artifact, #type = :type, description = :description, updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#type": "type",
    },
    ExpressionAttributeValues: {
      ":artifact": artifact ?? existing.artifact,
      ":type": type ?? existing.type,
      ":description": description ?? existing.description,
      ":updatedAt": updatedAt,
    },
  });

  await tracedDdbDocClient.send(updateCmd);

  return { message: "Threat updated successfully" };
};

// Delete threat
const deleteThreat = async (event) => {
  await verifyAuth(event);

  const threatId = event.pathParameters.id;
  const body = JSON.parse(event.body);
  const { createdAt } = body;

  if (!createdAt || typeof createdAt !== "string") {
    console.error(
      "Validation error: createdAt is required and must be a string"
    );
    throw new Error("createdAt is required and must be a string");
  }

  // Check if threat exists
  const getCmd = new GetCommand({
    TableName: DIGITAL_THREATS_TABLE,
    Key: { threatId, createdAt },
  });

  const { Item } = await tracedDdbDocClient.send(getCmd);
  if (!Item) {
    console.error("Threat not found:", threatId);
    throw new Error("Threat not found");
  }

  // Cascade delete all threat-likes for this threatId
  let likeDeleteWarning = null;
  try {
    const queryCmd = new QueryCommand({
      TableName: THREAT_LIKES_TABLE,
      IndexName: "threatId-index",
      KeyConditionExpression: "threatId = :threatId",
      ExpressionAttributeValues: { ":threatId": threatId },
      ProjectionExpression: "userId, threatId",
    });

    const { Items: likeItems } = await tracedDdbDocClient.send(queryCmd);
    if (likeItems && likeItems.length > 0) {
      // Batch delete in chunks of 25
      for (let i = 0; i < likeItems.length; i += 25) {
        const batch = likeItems.slice(i, i + 25);
        const deleteRequests = batch.map((item) => ({
          DeleteRequest: {
            Key: { userId: item.userId, threatId: item.threatId },
          },
        }));

        const batchCmd = new BatchWriteCommand({
          RequestItems: {
            [THREAT_LIKES_TABLE]: deleteRequests,
          },
        });

        const batchRes = await tracedDdbDocClient.send(batchCmd);
        if (
          batchRes.UnprocessedItems &&
          Object.keys(batchRes.UnprocessedItems).length > 0
        ) {
          likeDeleteWarning = "Some threat-likes could not be deleted";
        }
      }
    }
  } catch (error) {
    likeDeleteWarning = "Failed to delete some or all threat-likes";
  }

  // Delete the threat itself
  const deleteCmd = new DeleteCommand({
    TableName: DIGITAL_THREATS_TABLE,
    Key: { threatId, createdAt },
  });

  await tracedDdbDocClient.send(deleteCmd);

  if (likeDeleteWarning) {
    return {
      message: "Threat deleted, but some threat-likes may remain.",
      warning: likeDeleteWarning,
    };
  }

  return { message: "Threat deleted successfully" };
};

// Like threat
const likeThreat = async (event) => {
  const userPayload = await verifyAuth(event);
  const userId = userPayload.userId;
  const threatId = event.pathParameters.id;
  const body = JSON.parse(event.body);
  const { createdAt } = body;

  if (!createdAt || typeof createdAt !== "string") {
    console.error(
      "Validation error: createdAt is required and must be a string"
    );
    throw new Error("createdAt is required and must be a string");
  }

  // Check if already liked (idempotency)
  const likeKey = { userId, threatId };
  const getLike = new GetCommand({
    TableName: THREAT_LIKES_TABLE,
    Key: likeKey,
  });

  const { Item: likeItem } = await tracedDdbDocClient.send(getLike);
  if (likeItem) {
    return { message: "Already liked" };
  }

  // Upvote transaction
  const transactCmd = new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: DIGITAL_THREATS_TABLE,
          Key: { threatId, createdAt },
          UpdateExpression: "SET likes = if_not_exists(likes, :zero) + :inc",
          ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
          ConditionExpression:
            "attribute_exists(threatId) AND attribute_exists(createdAt)",
        },
      },
      {
        Put: {
          TableName: THREAT_LIKES_TABLE,
          Item: { userId, threatId, createdAt },
          ConditionExpression:
            "attribute_not_exists(userId) AND attribute_not_exists(threatId)",
        },
      },
    ],
  });

  try {
    await tracedDdbDocClient.send(transactCmd);
    return { message: "Liked successfully" };
  } catch (error) {
    if (error.name === "TransactionCanceledException") {
      return { message: "Already liked" };
    }
    throw error;
  }
};

// Unlike threat
const unlikeThreat = async (event) => {
  const userPayload = await verifyAuth(event);
  const userId = userPayload.userId;
  const threatId = event.pathParameters.id;
  const body = JSON.parse(event.body);
  const { createdAt } = body;

  if (!createdAt || typeof createdAt !== "string") {
    console.error(
      "Validation error: createdAt is required and must be a string"
    );
    throw new Error("createdAt is required and must be a string");
  }

  // Check if not liked (idempotency)
  const likeKey = { userId, threatId };
  const getLike = new GetCommand({
    TableName: THREAT_LIKES_TABLE,
    Key: likeKey,
  });

  const { Item: likeItem } = await tracedDdbDocClient.send(getLike);
  if (!likeItem) {
    return { message: "Already unliked" };
  }

  // Downvote transaction
  const transactCmd = new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: DIGITAL_THREATS_TABLE,
          Key: { threatId, createdAt },
          UpdateExpression: "SET likes = if_not_exists(likes, :zero) - :dec",
          ConditionExpression:
            "attribute_exists(threatId) AND attribute_exists(createdAt) AND likes > :zero",
          ExpressionAttributeValues: { ":dec": 1, ":zero": 0 },
        },
      },
      {
        Delete: {
          TableName: THREAT_LIKES_TABLE,
          Key: likeKey,
          ConditionExpression:
            "attribute_exists(userId) AND attribute_exists(threatId)",
        },
      },
    ],
  });

  try {
    await tracedDdbDocClient.send(transactCmd);
    return { message: "Unliked successfully" };
  } catch (error) {
    if (error.name === "TransactionCanceledException") {
      return { message: "Already unliked" };
    }
    throw error;
  }
};

// Get user's threats
const getMyThreats = async (event) => {
  const userPayload = await verifyAuth(event);
  const userId = userPayload.userId;

  const command = new QueryCommand({
    TableName: DIGITAL_THREATS_TABLE,
    IndexName: "submittedBy-createdAt-index",
    KeyConditionExpression: "submittedBy = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
    ScanIndexForward: false, // newest first
    Limit: 50,
  });

  const { Items } = await tracedDdbDocClient.send(command);

  return {
    threats: Items || [],
  };
};

// Get liked threats
const getLikedThreats = async (event) => {
  const userPayload = await verifyAuth(event);
  const userId = userPayload.userId;

  // Query threat-likes table for this user's likes
  const likesResult = await tracedDdbDocClient.send(
    new QueryCommand({
      TableName: THREAT_LIKES_TABLE,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
      Limit: 25,
    })
  );

  const likedThreats = likesResult.Items || [];
  if (likedThreats.length === 0) {
    return [];
  }

  const threatIds = likedThreats.map((like) => like.threatId);
  const uniqueThreatIds = Array.from(new Set(threatIds));

  // Query digital-threats table for all threatIds
  const digitalThreats = [];
  for (const threatId of uniqueThreatIds) {
    const threatResult = await tracedDdbDocClient.send(
      new QueryCommand({
        TableName: DIGITAL_THREATS_TABLE,
        IndexName: "threatId-index",
        KeyConditionExpression: "threatId = :tid",
        ExpressionAttributeValues: { ":tid": threatId },
      })
    );
    if (threatResult.Items && threatResult.Items.length > 0) {
      digitalThreats.push(...threatResult.Items);
    }
  }

  return digitalThreats;
};

// Get like status
const getLikeStatus = async (event) => {
  const userPayload = await verifyAuth(event);
  const userId = userPayload.userId;
  const threatId = event.pathParameters.id;

  if (!threatId || typeof threatId !== "string") {
    console.error("Validation error: threatId is required in the URL");
    throw new Error("threatId is required in the URL");
  }

  const getLike = new GetCommand({
    TableName: THREAT_LIKES_TABLE,
    Key: { userId, threatId },
  });

  const { Item } = await tracedDdbDocClient.send(getLike);

  return { liked: !!Item };
};

// Update threat status (admin only)
const updateThreatStatus = async (event) => {
  const userPayload = await verifyAuth(event);

  // Only admins can update threat status
  if (userPayload.role !== "admin") {
    console.error("Unauthorized access - Admin required");
    throw new Error("Forbidden - Admin access required");
  }

  const threatId = event.pathParameters.id;
  const body = JSON.parse(event.body);
  const { createdAt, status } = body;

  if (!createdAt || !status) {
    console.error("Validation error: createdAt and status are required");
    throw new Error("createdAt and status are required");
  }

  if (!["verified", "unverified"].includes(status)) {
    console.error(
      "Validation error: status must be either 'verified' or 'unverified'"
    );
    throw new Error("Status must be either 'verified' or 'unverified'");
  }

  const updateCommand = new UpdateCommand({
    TableName: DIGITAL_THREATS_TABLE,
    Key: {
      threatId: threatId,
      createdAt: createdAt,
    },
    UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":status": status,
      ":updatedAt": new Date().toISOString(),
    },
    ReturnValues: "ALL_NEW",
  });

  const result = await tracedDdbDocClient.send(updateCommand);

  // Send notification if status is verified
  if (status === "verified") {
    sendVerificationNotification(threatId, createdAt).catch((error) => {
      console.error(
        `Failed to send notification for threat ${threatId}:`,
        error
      );
    });
  }

  return {
    message: "Threat status updated successfully",
    threat: result.Attributes,
    notificationSent: status === "verified",
  };
};

// Main Lambda handler
export const handler = async (event) => {
  console.log("EVENT:", JSON.stringify(event));

  const corsHeaders = {
    "Access-Control-Allow-Origin": getCorsOrigin(event),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
  };

  let body;
  let statusCode = 200;

  try {
    // CORS Preflight (OPTIONS request)
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: "CORS preflight successful" }),
      };
    }

    // Route: POST /digital-threats
    if (event.resource === "/digital-threats" && event.httpMethod === "POST") {
      body = await createThreat(event);
    }
    // Route: GET /digital-threats
    else if (
      event.resource === "/digital-threats" &&
      event.httpMethod === "GET"
    ) {
      body = await getAllThreats(event);
    }
    // Route: POST /digital-threats/{id}
    else if (
      event.resource === "/digital-threats/{id}" &&
      event.httpMethod === "POST"
    ) {
      body = await getThreatById(event);
    }
    // Route: PUT /digital-threats/{id}
    else if (
      event.resource === "/digital-threats/{id}" &&
      event.httpMethod === "PUT"
    ) {
      body = await updateThreat(event);
    }
    // Route: DELETE /digital-threats/{id}
    else if (
      event.resource === "/digital-threats/{id}" &&
      event.httpMethod === "DELETE"
    ) {
      body = await deleteThreat(event);
    }
    // Route: POST /digital-threats/{id}/like
    else if (
      event.resource === "/digital-threats/{id}/like" &&
      event.httpMethod === "POST"
    ) {
      body = await likeThreat(event);
    }
    // Route: DELETE /digital-threats/{id}/like
    else if (
      event.resource === "/digital-threats/{id}/like" &&
      event.httpMethod === "DELETE"
    ) {
      body = await unlikeThreat(event);
    }
    // Route: GET /digital-threats/my-threats
    else if (
      event.resource === "/digital-threats/my-threats" &&
      event.httpMethod === "GET"
    ) {
      body = await getMyThreats(event);
    }
    // Route: GET /digital-threats/liked
    else if (
      event.resource === "/digital-threats/liked" &&
      event.httpMethod === "GET"
    ) {
      body = await getLikedThreats(event);
    }
    // Route: GET /digital-threats/{id}/like-status
    else if (
      event.resource === "/digital-threats/{id}/like-status" &&
      event.httpMethod === "GET"
    ) {
      body = await getLikeStatus(event);
    }
    // Route: PATCH /digital-threats/{id}/status
    else if (
      event.resource === "/digital-threats/{id}/status" &&
      event.httpMethod === "PATCH"
    ) {
      body = await updateThreatStatus(event);
    }
    // Unknown route
    else {
      console.error(
        "Unsupported route:",
        `${event.resource} ${event.httpMethod}`
      );
      throw new Error(
        `Unsupported route: ${event.resource} ${event.httpMethod}`
      );
    }
  } catch (error) {
    statusCode =
      error.message.includes("Unauthorized") ||
      error.message.includes("not authenticated")
        ? 401
        : error.message.includes("Forbidden")
        ? 403
        : error.message.includes("not found") ||
          error.message.includes("Not found")
        ? 404
        : error.message.includes("already exists")
        ? 409
        : error.message.includes("required") ||
          error.message.includes("must be")
        ? 400
        : 500;
    body = { error: error.message };
    console.error("Lambda error:", error);
  }

  return {
    statusCode,
    body: JSON.stringify(body),
    headers: corsHeaders,
  };
};
