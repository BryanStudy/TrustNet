import { verifyAuth, ddbDocClient } from "/opt/nodejs/index.js";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import AWSXRay from "aws-xray-sdk-core";

const allowedOrigins = ["http://localhost:3000", "http://localhost:8080"];

// Initialize X-Ray tracing for DynamoDB
const tracedDdbDocClient = AWSXRay.captureAWSv3Client(ddbDocClient);

function getCorsOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  return allowedOrigins.includes(origin) ? origin : "";
}

// Dashboard data handler (GET /dashboard)
async function handleDashboard(event) {
  try {
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

    // Fetch only the data we actually need
    const [
      usersResult,
      reportsResult,
      threatsResult,
      articlesResult,
      likesResult,
    ] = await Promise.all([
      // Users data - only need for count and registration dates
      tracedDdbDocClient.send(
        new ScanCommand({
          TableName: "users",
          ProjectionExpression: "userId, createdAt",
        })
      ),

      // Scam reports data - only need for count
      tracedDdbDocClient.send(
        new ScanCommand({
          TableName: "scam-reports",
          ProjectionExpression: "reportId",
        })
      ),

      // Digital threats data - need for count and status distribution
      tracedDdbDocClient.send(
        new ScanCommand({
          TableName: "digital-threats",
          ProjectionExpression: "threatId, #s",
          ExpressionAttributeNames: {
            "#s": "status",
          },
        })
      ),

      // Articles data - only need for count
      tracedDdbDocClient.send(
        new ScanCommand({
          TableName: "articles",
          ProjectionExpression: "articleId",
        })
      ),

      // Threat likes data - only need for count
      tracedDdbDocClient.send(
        new ScanCommand({
          TableName: "threat-likes",
          ProjectionExpression: "userId",
        })
      ),
    ]);

    const users = usersResult.Items || [];
    const reports = reportsResult.Items || [];
    const threats = threatsResult.Items || [];
    const articles = articlesResult.Items || [];
    const likes = likesResult.Items || [];

    // 1. User registrations over time (last 6 months)
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toISOString().slice(0, 7), // YYYY-MM format
        name: date.toLocaleDateString("en", {
          month: "short",
          year: "numeric",
        }),
      };
    }).reverse();

    const userRegistrations = last6Months.map((month) => {
      const count = users.filter(
        (user) => user.createdAt && user.createdAt.startsWith(month.month)
      ).length;
      return { ...month, users: count };
    });

    // 2. Threat status distribution
    const threatsByStatus = threats.reduce((acc, threat) => {
      const status = threat.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const threatStatusData = Object.entries(threatsByStatus).map(
      ([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count,
      })
    );

    // 3. Summary statistics
    const stats = {
      totalUsers: users.length,
      totalReports: reports.length,
      totalThreats: threats.length,
      totalArticles: articles.length,
      totalLikes: likes.length,
      verifiedThreats: threats.filter((t) => t.status === "verified").length,
      activeUsers: users.filter((user) => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        return user.createdAt && new Date(user.createdAt) > oneMonthAgo;
      }).length,
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": getCorsOrigin(event),
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        userRegistrations,
        threatStatusData,
        stats,
      }),
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
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
    "Access-Control-Allow-Methods": "GET,OPTIONS",
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

    // Route: GET /dashboard
    if (event.resource === "/dashboard" && event.httpMethod === "GET") {
      const response = await handleDashboard(event);
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
