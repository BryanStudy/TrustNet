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
import { v4 as uuidv4 } from "uuid";

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
      throw new Error(`${field} is required`);
    }
  }

  if (!validTypes.includes(data.type)) {
    throw new Error("Type must be url, email, or phone");
  }

  return true;
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

  const { Items } = await ddbDocClient.send(findArtifactCommand);
  if (Items && Items.length > 0) {
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

  await ddbDocClient.send(putCommand);

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

  const { Items } = await ddbDocClient.send(command);

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
    throw new Error("createdAt is required and must be a string");
  }

  // Fetch the threat
  const threatCommand = new GetCommand({
    TableName: DIGITAL_THREATS_TABLE,
    Key: { threatId, createdAt },
  });

  const { Item: threatItem } = await ddbDocClient.send(threatCommand);

  if (!threatItem) {
    throw new Error("Threat not found");
  }

  // Fetch user details
  let reporterName = "Unknown User";
  try {
    const userCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: threatItem.submittedBy },
    });
    const { Item: userItem } = await ddbDocClient.send(userCommand);

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
    throw new Error("createdAt is required and must be a string");
  }

  // Fetch existing item
  const getCmd = new GetCommand({
    TableName: DIGITAL_THREATS_TABLE,
    Key: { threatId, createdAt },
  });

  const { Item: existing } = await ddbDocClient.send(getCmd);
  if (!existing) {
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

  await ddbDocClient.send(updateCmd);

  return { message: "Threat updated successfully" };
};

// Delete threat
const deleteThreat = async (event) => {
  await verifyAuth(event);

  const threatId = event.pathParameters.id;
  const body = JSON.parse(event.body);
  const { createdAt } = body;

  if (!createdAt || typeof createdAt !== "string") {
    throw new Error("createdAt is required and must be a string");
  }

  // Check if threat exists
  const getCmd = new GetCommand({
    TableName: DIGITAL_THREATS_TABLE,
    Key: { threatId, createdAt },
  });

  const { Item } = await ddbDocClient.send(getCmd);
  if (!Item) {
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

    const { Items: likeItems } = await ddbDocClient.send(queryCmd);
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

        const batchRes = await ddbDocClient.send(batchCmd);
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

  await ddbDocClient.send(deleteCmd);

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
    throw new Error("createdAt is required and must be a string");
  }

  // Check if already liked (idempotency)
  const likeKey = { userId, threatId };
  const getLike = new GetCommand({
    TableName: THREAT_LIKES_TABLE,
    Key: likeKey,
  });

  const { Item: likeItem } = await ddbDocClient.send(getLike);
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
    await ddbDocClient.send(transactCmd);
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
    throw new Error("createdAt is required and must be a string");
  }

  // Check if not liked (idempotency)
  const likeKey = { userId, threatId };
  const getLike = new GetCommand({
    TableName: THREAT_LIKES_TABLE,
    Key: likeKey,
  });

  const { Item: likeItem } = await ddbDocClient.send(getLike);
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
    await ddbDocClient.send(transactCmd);
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

  const { Items } = await ddbDocClient.send(command);

  return {
    threats: Items || [],
  };
};

// Get liked threats
const getLikedThreats = async (event) => {
  const userPayload = await verifyAuth(event);
  const userId = userPayload.userId;

  // Query threat-likes table for this user's likes
  const likesResult = await ddbDocClient.send(
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
    const threatResult = await ddbDocClient.send(
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
    throw new Error("threatId is required in the URL");
  }

  const getLike = new GetCommand({
    TableName: THREAT_LIKES_TABLE,
    Key: { userId, threatId },
  });

  const { Item } = await ddbDocClient.send(getLike);

  return { liked: !!Item };
};

// Update threat status (admin only)
const updateThreatStatus = async (event) => {
  const userPayload = await verifyAuth(event);

  // Only admins can update threat status
  if (userPayload.role !== "admin") {
    throw new Error("Forbidden - Admin access required");
  }

  const threatId = event.pathParameters.id;
  const body = JSON.parse(event.body);
  const { createdAt, status } = body;

  if (!createdAt || !status) {
    throw new Error("createdAt and status are required");
  }

  if (!["verified", "unverified"].includes(status)) {
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

  const result = await ddbDocClient.send(updateCommand);

  return {
    message: "Threat status updated successfully",
    threat: result.Attributes,
  };
};

// Main Lambda handler
export const handler = async (event) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
  };

  try {
    switch (event.routeKey) {
      // Create threat
      case "POST /digital-threats":
        body = await createThreat(event);
        break;

      // Get all threats
      case "GET /digital-threats":
        body = await getAllThreats(event);
        break;

      // Get single threat by ID (requires POST with createdAt in body)
      case "POST /digital-threats/{id}":
        body = await getThreatById(event);
        break;

      // Update threat
      case "PUT /digital-threats/{id}":
        body = await updateThreat(event);
        break;

      // Delete threat
      case "DELETE /digital-threats/{id}":
        body = await deleteThreat(event);
        break;

      // Like threat
      case "POST /digital-threats/{id}/like":
        body = await likeThreat(event);
        break;

      // Unlike threat
      case "DELETE /digital-threats/{id}/like":
        body = await unlikeThreat(event);
        break;

      // Get user's threats
      case "GET /digital-threats/my-threats":
        body = await getMyThreats(event);
        break;

      // Get liked threats
      case "GET /digital-threats/liked":
        body = await getLikedThreats(event);
        break;

      // Get like status
      case "GET /digital-threats/{id}/like-status":
        body = await getLikeStatus(event);
        break;

      // Update threat status (admin only)
      case "PATCH /digital-threats/{id}/status":
        body = await updateThreatStatus(event);
        break;

      // Handle OPTIONS for CORS
      case "OPTIONS /digital-threats":
      case "OPTIONS /digital-threats/{id}":
      case "OPTIONS /digital-threats/{id}/like":
      case "OPTIONS /digital-threats/{id}/like-status":
      case "OPTIONS /digital-threats/{id}/status":
      case "OPTIONS /digital-threats/my-threats":
      case "OPTIONS /digital-threats/liked":
        body = { message: "CORS preflight" };
        break;

      default:
        throw new Error(`Unsupported route: ${event.routeKey}`);
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
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};
