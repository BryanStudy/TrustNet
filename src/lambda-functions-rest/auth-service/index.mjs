import { verifyAuth, ddbDocClient } from "/opt/nodejs/index.js";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SignJWT } from "jose";
import AWSXRay from "aws-xray-sdk-core";

const JWT_SECRET = process.env.JWT_SECRET;

const allowedOrigins = ["http://localhost:3000", "http://localhost:8080"];

// Initialize X-Ray tracing for DynamoDB
const tracedDdbDocClient = AWSXRay.captureAWSv3Client(ddbDocClient);

function getCorsOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  return allowedOrigins.includes(origin) ? origin : "";
}

// Simple email validation (replacing Zod)
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Login functions
async function handleLogin(event) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { email, password } = body;

    // Validate request body (matching Zod validation)
    const validationErrors = [];

    if (!email || !validateEmail(email)) {
      validationErrors.push("Invalid email format");
    }

    if (!password || password.length < 1) {
      validationErrors.push("Password is required");
    }

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

    // Query DynamoDB for user
    const command = new QueryCommand({
      TableName: "users",
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
      Limit: 1,
    });

    const { Items } = await tracedDdbDocClient.send(command);
    const user = Items && Items[0];

    if (!user || user.password !== password) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": getCorsOrigin(event),
          "Access-Control-Allow-Credentials": "true",
        },
        body: JSON.stringify({ error: "Invalid email or password." }),
      };
    }

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

    // Return response matching Next.js structure
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
        "Set-Cookie": `token=${jwt}; HttpOnly; Path=/; Max-Age=604800; SameSite=None; Secure;`,
      },
      body: JSON.stringify({ user: { ...user, password: undefined } }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("Error in login endpoint:", error);
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

// Logout function
async function handleLogout(event) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": getCorsOrigin(event),
      "Access-Control-Allow-Credentials": "true",
      "Set-Cookie":
        "token=; HttpOnly; Path=/; Max-Age=0; SameSite=None; Secure;",
    },
    body: JSON.stringify({ success: true }),
  };
}

// Me function
async function handleMe(event) {
  let userPayload;

  try {
    userPayload = await verifyAuth(event);
    console.log("Event", event);
  } catch {
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

  try {
    const userId = userPayload.userId;
    const command = new QueryCommand({
      TableName: "users",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
      Limit: 1,
    });

    const { Items } = await tracedDdbDocClient.send(command);
    const user = Items && Items[0];

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
    console.error("Error fetching user from DynamoDB:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: "Internal server error" }),
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

    // Route: POST /login
    if (event.resource === "/login" && event.httpMethod === "POST") {
      const response = await handleLogin(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: POST /logout
    if (event.resource === "/logout" && event.httpMethod === "POST") {
      const response = await handleLogout(event);
      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    }

    // Route: GET /me
    if (event.resource === "/me" && event.httpMethod === "GET") {
      const response = await handleMe(event);
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
