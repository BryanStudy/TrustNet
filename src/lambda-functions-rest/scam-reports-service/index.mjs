import {
  verifyAuth,
  ddbDocClient,
  constructFileUrl,
} from "/opt/nodejs/index.js";
import {
  QueryCommand,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import AWSXRay from "aws-xray-sdk-core";

const allowedOrigins = ["http://localhost:3000", "http://localhost:8080"];

function getCorsOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  return allowedOrigins.includes(origin) ? origin : "";
}

// Table names
const SCAM_REPORTS_TABLE = "scam-reports";
const USERS_TABLE = "users";

// S3 client setup
const s3Client = new S3Client({});

// X-Ray tracing
const tracedDdbDocClient = AWSXRay.captureAWSv3Client(ddbDocClient);
const tracedS3Client = AWSXRay.captureAWSv3Client(s3Client);

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

  await tracedS3Client.send(command);
}

// Schema validation
const validateCreateScamReport = (data) => {
  const errors = [];

  if (
    !data.title ||
    typeof data.title !== "string" ||
    data.title.trim() === ""
  ) {
    errors.push("Title is required");
  }

  if (
    !data.description ||
    typeof data.description !== "string" ||
    data.description.trim() === ""
  ) {
    errors.push("Description is required");
  }

  if (typeof data.anonymized !== "boolean") {
    errors.push("Anonymized must be a boolean");
  }

  if (
    !data.image ||
    typeof data.image !== "string" ||
    data.image.trim() === ""
  ) {
    errors.push("Image filename is required");
  }

  if (errors.length > 0) {
    throw new Error(errors.join(", "));
  }

  return true;
};

const validateUpdateScamReport = (data) => {
  const errors = [];

  if (!data.createdAt || typeof data.createdAt !== "string") {
    errors.push("createdAt is required and must be a string");
  }

  if (
    data.title !== undefined &&
    (!data.title || typeof data.title !== "string" || data.title.trim() === "")
  ) {
    errors.push("Title is required");
  }

  if (
    data.description !== undefined &&
    (!data.description ||
      typeof data.description !== "string" ||
      data.description.trim() === "")
  ) {
    errors.push("Description is required");
  }

  if (data.anonymized !== undefined && typeof data.anonymized !== "boolean") {
    errors.push("Anonymized must be a boolean");
  }

  if (
    data.image !== undefined &&
    (!data.image || typeof data.image !== "string" || data.image.trim() === "")
  ) {
    errors.push("Image filename is required");
  }

  if (errors.length > 0) {
    throw new Error(errors.join(", "));
  }

  return true;
};

// Create scam report
const createScamReport = async (event) => {
  const userPayload = await verifyAuth(event);
  const body = JSON.parse(event.body);

  // Validate input
  validateCreateScamReport(body);

  const reportId = uuidv4();
  const userId = userPayload.userId;
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;
  const viewable = "REPORTS";

  const newReport = {
    reportId,
    userId,
    title: body.title,
    description: body.description,
    anonymized: body.anonymized,
    image: body.image,
    createdAt,
    updatedAt,
    viewable,
  };

  const putCommand = new PutCommand({
    TableName: SCAM_REPORTS_TABLE,
    Item: newReport,
  });

  await tracedDdbDocClient.send(putCommand);

  return {
    message: "Scam report created successfully",
  };
};

// Get all scam reports with pagination and user details
const getAllScamReports = async (event) => {
  const { queryStringParameters } = event;
  const limit = parseInt(queryStringParameters?.limit || "6", 10);
  const lastEvaluatedKeyParam = queryStringParameters?.lastEvaluatedKey;

  let lastEvaluatedKey = undefined;
  if (lastEvaluatedKeyParam) {
    try {
      lastEvaluatedKey = JSON.parse(lastEvaluatedKeyParam);
    } catch (e) {
      throw new Error("Invalid lastEvaluatedKey param");
    }
  }

  // Fetch limit+1 items to check if there is a next page
  const queryCommand = new QueryCommand({
    TableName: SCAM_REPORTS_TABLE,
    IndexName: "viewable-createdAt-index",
    KeyConditionExpression: "viewable = :viewable",
    ExpressionAttributeValues: { ":viewable": "REPORTS" },
    ScanIndexForward: false, // newest first
    Limit: limit + 1,
    ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
  });

  const { Items } = await tracedDdbDocClient.send(queryCommand);
  let reports = Items || [];
  let nextEvaluatedKey = null;

  if (reports.length > limit) {
    // There is a next page
    const lastItem = reports[limit - 1];
    // Only return the first 'limit' items
    reports = reports.slice(0, limit);
    nextEvaluatedKey = {
      reportId: lastItem.reportId,
      createdAt: lastItem.createdAt,
      viewable: "REPORTS",
    };
  }

  // Collect unique userIds
  const userIds = Array.from(new Set(reports.map((r) => r.userId)));

  // Batch get user info
  let userMap = {};
  if (userIds.length > 0) {
    const batchGetCommand = new BatchGetCommand({
      RequestItems: {
        [USERS_TABLE]: {
          Keys: userIds.map((userId) => ({ userId })),
        },
      },
    });
    const batchResult = await tracedDdbDocClient.send(batchGetCommand);
    const users = batchResult.Responses?.[USERS_TABLE] || [];
    userMap = Object.fromEntries(users.map((u) => [u.userId, u]));
  }

  // Map reports to ScamReportWithUserDetail
  const reportsWithUserDetail = reports.map((report) => {
    const user = userMap[report.userId];
    return {
      ...report,
      image: constructFileUrl(report.image, "scam-reports"),
      reporterName: user
        ? `${user.firstName} ${user.lastName}`
        : "Unknown User",
      reporterPicture: user
        ? constructFileUrl(user.picture, "profile-pictures")
        : "",
    };
  });

  return {
    reports: reportsWithUserDetail,
    lastEvaluatedKey: nextEvaluatedKey,
  };
};

// Get basic scam report by ID (without user details)
const getScamReportById = async (event) => {
  await verifyAuth(event);

  const reportId = event.pathParameters.id;
  const { queryStringParameters } = event;
  const createdAt = queryStringParameters?.createdAt;

  if (!createdAt) {
    throw new Error("createdAt is required");
  }

  // Get the specific scam report
  const reportCommand = new GetCommand({
    TableName: SCAM_REPORTS_TABLE,
    Key: {
      reportId,
      createdAt,
    },
  });

  const { Item } = await tracedDdbDocClient.send(reportCommand);

  if (!Item) {
    throw new Error("Report not found");
  }

  const report = {
    ...Item,
    image: constructFileUrl(Item.image, "scam-reports"),
  };

  return {
    report,
  };
};

// Get scam report by ID with user detail
const getScamReportByIdWithUserDetail = async (event) => {
  await verifyAuth(event);

  const reportId = event.pathParameters.id;
  const { queryStringParameters } = event;
  const createdAt = queryStringParameters?.createdAt;

  if (!createdAt) {
    throw new Error("createdAt is required");
  }

  // Get the specific scam report
  const reportCommand = new GetCommand({
    TableName: SCAM_REPORTS_TABLE,
    Key: {
      reportId,
      createdAt,
    },
  });

  const { Item } = await tracedDdbDocClient.send(reportCommand);

  if (!Item) {
    throw new Error("Report not found");
  }

  const report = Item;

  // Get user info
  let reporterName = "Unknown User";
  let reporterPicture = "";

  try {
    const userCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: report.userId },
    });
    const { Item: userItem } = await tracedDdbDocClient.send(userCommand);

    if (userItem && userItem.firstName && userItem.lastName) {
      reporterName = `${userItem.firstName} ${userItem.lastName}`;
      reporterPicture = userItem.picture
        ? constructFileUrl(userItem.picture, "profile-pictures")
        : "";
    }
  } catch (userError) {
    console.error("Failed to fetch user:", userError);
  }

  // Map to ScamReportWithUserDetail
  const reportWithUserDetail = {
    ...report,
    image: constructFileUrl(report.image, "scam-reports"),
    reporterName,
    reporterPicture,
  };

  return {
    report: reportWithUserDetail,
  };
};

// Update scam report
const updateScamReport = async (event) => {
  await verifyAuth(event);

  const reportId = event.pathParameters.id;
  const body = JSON.parse(event.body);

  // Validate input
  validateUpdateScamReport(body);

  const { title, description, image, anonymized, createdAt } = body;
  const updatedAt = new Date().toISOString();

  const command = new UpdateCommand({
    TableName: SCAM_REPORTS_TABLE,
    Key: {
      reportId,
      createdAt,
    },
    UpdateExpression:
      "set title = :title, description = :description, image = :image, anonymized = :anonymized, updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ":title": title,
      ":description": description,
      ":image": image,
      ":anonymized": anonymized,
      ":updatedAt": updatedAt,
    },
  });

  await tracedDdbDocClient.send(command);

  return { message: "Scam report updated successfully" };
};

// Delete scam report
const deleteScamReport = async (event) => {
  await verifyAuth(event);

  const reportId = event.pathParameters.id;
  const body = JSON.parse(event.body);
  const { createdAt, image } = body;

  if (!createdAt || typeof createdAt !== "string") {
    throw new Error("createdAt is required and must be a string");
  }

  if (!image || typeof image !== "string") {
    throw new Error("Image filename is required");
  }

  // Delete the report from DynamoDB
  const deleteCommand = new DeleteCommand({
    TableName: SCAM_REPORTS_TABLE,
    Key: { reportId, createdAt },
  });

  await tracedDdbDocClient.send(deleteCommand);

  // Delete the image from S3
  try {
    await deleteFile(image, "scam-reports");
  } catch (err) {
    throw new Error("Report deleted but failed to delete image from S3");
  }

  return { message: "Scam report and image deleted successfully" };
};

// Get user's own scam reports
const getMyScamReports = async (event) => {
  const userPayload = await verifyAuth(event);
  const userId = userPayload.userId;

  const command = new QueryCommand({
    TableName: SCAM_REPORTS_TABLE,
    IndexName: "userId-index",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
    ScanIndexForward: false, // newest first
    Limit: 25,
  });

  const { Items } = await tracedDdbDocClient.send(command);

  return {
    reports: Items || [],
  };
};

// Search scam reports by title
const searchScamReports = async (event) => {
  const { queryStringParameters } = event;
  const title = queryStringParameters?.title || "";
  const limit = parseInt(queryStringParameters?.limit || "6", 10);
  const lastEvaluatedKeyParam = queryStringParameters?.lastEvaluatedKey;

  if (!title) {
    throw new Error("Title is required for search");
  }

  let lastEvaluatedKey = undefined;
  if (lastEvaluatedKeyParam) {
    try {
      lastEvaluatedKey = JSON.parse(lastEvaluatedKeyParam);
    } catch (e) {
      throw new Error("Invalid lastEvaluatedKey param");
    }
  }

  // Query scam reports by title prefix
  const queryCommand = new QueryCommand({
    TableName: SCAM_REPORTS_TABLE,
    IndexName: "viewable-title-index",
    KeyConditionExpression:
      "viewable = :viewable AND begins_with(title, :prefix)",
    ExpressionAttributeValues: {
      ":viewable": "REPORTS",
      ":prefix": title,
    },
    ScanIndexForward: false, // newest first
    Limit: limit,
    ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
  });

  const { Items, LastEvaluatedKey } = await tracedDdbDocClient.send(
    queryCommand
  );
  const reports = Items || [];

  // Collect unique userIds
  const userIds = Array.from(new Set(reports.map((r) => r.userId)));

  // Batch get user info
  let userMap = {};
  if (userIds.length > 0) {
    const batchGetCommand = new BatchGetCommand({
      RequestItems: {
        [USERS_TABLE]: {
          Keys: userIds.map((userId) => ({ userId })),
        },
      },
    });
    const batchResult = await tracedDdbDocClient.send(batchGetCommand);
    const users = batchResult.Responses?.[USERS_TABLE] || [];
    userMap = Object.fromEntries(users.map((u) => [u.userId, u]));
  }

  // Map reports to ScamReportWithUserDetail
  const reportsWithUserDetail = reports.map((report) => {
    const user = userMap[report.userId];
    return {
      ...report,
      image: constructFileUrl(report.image, "scam-reports"),
      reporterName: user
        ? `${user.firstName} ${user.lastName}`
        : "Unknown User",
      reporterPicture: user
        ? constructFileUrl(user.picture, "profile-pictures")
        : "",
    };
  });

  return {
    reports: reportsWithUserDetail,
    lastEvaluatedKey: LastEvaluatedKey || null,
  };
};

// Main Lambda handler
export const handler = async (event) => {
  console.log("EVENT:", JSON.stringify(event));

  const corsHeaders = {
    "Access-Control-Allow-Origin": getCorsOrigin(event),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
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

    // Route: POST /scam-reports
    if (event.resource === "/scam-reports" && event.httpMethod === "POST") {
      body = await createScamReport(event);
    }
    // Route: GET /scam-reports
    else if (event.resource === "/scam-reports" && event.httpMethod === "GET") {
      body = await getAllScamReports(event);
    }
    // Route: GET /scam-reports/{id}
    else if (
      event.resource === "/scam-reports/{id}" &&
      event.httpMethod === "GET"
    ) {
      body = await getScamReportById(event);
    }
    // Route: GET /scam-reports/{id}/with-user-detail
    else if (
      event.resource === "/scam-reports/{id}/with-user-detail" &&
      event.httpMethod === "GET"
    ) {
      body = await getScamReportByIdWithUserDetail(event);
    }
    // Route: PUT /scam-reports/{id}
    else if (
      event.resource === "/scam-reports/{id}" &&
      event.httpMethod === "PUT"
    ) {
      body = await updateScamReport(event);
    }
    // Route: DELETE /scam-reports/{id}
    else if (
      event.resource === "/scam-reports/{id}" &&
      event.httpMethod === "DELETE"
    ) {
      body = await deleteScamReport(event);
    }
    // Route: GET /scam-reports/my-reports
    else if (
      event.resource === "/scam-reports/my-reports" &&
      event.httpMethod === "GET"
    ) {
      body = await getMyScamReports(event);
    }
    // Route: GET /scam-reports/search
    else if (
      event.resource === "/scam-reports/search" &&
      event.httpMethod === "GET"
    ) {
      body = await searchScamReports(event);
    }
    // Unknown route
    else {
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
