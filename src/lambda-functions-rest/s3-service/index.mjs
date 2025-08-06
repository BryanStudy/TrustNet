import {
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const allowedOrigins = ["http://localhost:3000", "http://localhost:8080"];

function getCorsOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  return allowedOrigins.includes(origin) ? origin : "";
}

// S3 client setup
const s3Client = new S3Client({});

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

function getAwsRegion() {
  return process.env.AWS_REGION || "ap-southeast-1";
}

function generateFileUrl(key) {
  const bucketName = getBucketName();
  const region = getAwsRegion();
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

function constructFileUrl(fileName, folderPath) {
  const key = folderPath
    ? `${folderPath.replace(/^\/+|\/+$/g, "")}/${fileName}`
    : fileName;
  return generateFileUrl(key);
}

function constructS3Key(fileName, folderPath) {
  return folderPath
    ? `${folderPath.replace(/^\/+|\/+$/g, "")}/${fileName}`
    : fileName;
}

// Validation functions
function validateUploadRequest(data) {
  const errors = [];

  if (!data.fileName || data.fileName.length < 1) {
    errors.push("File name is required");
  }

  if (!data.contentType || data.contentType.length < 1) {
    errors.push("Content type is required");
  } else if (!data.contentType.startsWith("image/")) {
    errors.push("Only image files are allowed");
  }

  if (!data.size || data.size <= 0) {
    errors.push("File size must be positive");
  } else if (data.size > 5 * 1024 * 1024) {
    errors.push("File size cannot exceed 5MB");
  }

  return errors;
}

function validateReadRequest(data) {
  const errors = [];

  if (!data.folderPath) {
    errors.push("Folder path is required");
  }

  return errors;
}

function validateDeleteRequest(data) {
  const errors = [];

  if (!data.key) {
    errors.push("Key is required");
  }

  return errors;
}

// S3 service functions
async function createUploadUrl(request) {
  const { fileName, contentType, size, folderPath } = request;

  const uniqueFileName = `${uuidv4()}-${fileName}`;
  const s3Key = constructS3Key(uniqueFileName, folderPath);

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: s3Key,
    ContentType: contentType,
    ContentLength: size,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 300, // 5 minutes
  });

  const fileUrl = generateFileUrl(s3Key);

  return {
    presignedUrl,
    fileName: uniqueFileName,
    fileUrl,
  };
}

async function listFiles(folderPath) {
  // Ensure folder path ends with / for S3 listing
  const normalizedFolderPath = folderPath.endsWith("/")
    ? folderPath
    : `${folderPath}/`;

  const command = new ListObjectsV2Command({
    Bucket: getBucketName(),
    Prefix: normalizedFolderPath,
    MaxKeys: 1000,
  });

  const response = await s3Client.send(command);

  if (!response.Contents) {
    return { files: [] };
  }

  // Filter for image files and format the response
  const imageFiles = response.Contents.filter((obj) => {
    const key = obj.Key || "";
    const extension = key.toLowerCase().split(".").pop();
    return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
      extension || ""
    );
  })
    .map((obj) => {
      const key = obj.Key || "";
      const fileName = key.split("/").pop() || "";
      // Extract original filename by removing UUID prefix
      const originalFileName = fileName.includes("-")
        ? fileName.split("-").slice(1).join("-")
        : fileName;

      return {
        key: key,
        fileName: originalFileName,
        fullKey: key,
        size: obj.Size || 0,
        lastModified: obj.LastModified,
        url: generateFileUrl(key),
      };
    })
    .sort((a, b) => {
      const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return dateB - dateA; // Sort by newest first
    });

  return { files: imageFiles };
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

// Create presigned URL (POST /s3)
async function handleCreateUploadUrl(event) {
  try {
    const body = JSON.parse(event.body || "{}");

    const validationErrors = validateUploadRequest(body);
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          error: "Invalid request body",
          details: validationErrors,
        }),
      };
    }

    const uploadResponse = await createUploadUrl(body);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify(uploadResponse),
    };
  } catch (error) {
    console.error("Error creating presigned URL:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}

// List files (GET /s3)
async function handleListFiles(event) {
  try {
    const queryParams = event.queryStringParameters || {};
    const folderPath = queryParams.folderPath;

    if (!folderPath) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Folder path is required" }),
      };
    }

    const validationErrors = validateReadRequest({ folderPath });
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          error: "Invalid folder path",
          details: validationErrors,
        }),
      };
    }

    const filesResponse = await listFiles(folderPath);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify(filesResponse),
    };
  } catch (error) {
    console.error("Error reading S3 objects:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        error: "Failed to read files from S3",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}

// Delete file (DELETE /s3)
async function handleDeleteFile(event) {
  try {
    const body = JSON.parse(event.body || "{}");

    const validationErrors = validateDeleteRequest(body);
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({
          error: "Invalid request body - key is required",
          details: validationErrors,
        }),
      };
    }

    const { key, folderPath } = body;
    await deleteFile(key, folderPath);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ message: "File deleted successfully" }),
    };
  } catch (error) {
    console.error("Error deleting S3 object:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        error: "Failed to delete file",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
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
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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

    // Route: POST /s3
    if (event.resource === "/s3" && event.httpMethod === "POST") {
      const response = await handleCreateUploadUrl(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: GET /s3
    if (event.resource === "/s3" && event.httpMethod === "GET") {
      const response = await handleListFiles(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: DELETE /s3
    if (event.resource === "/s3" && event.httpMethod === "DELETE") {
      const response = await handleDeleteFile(event);
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
