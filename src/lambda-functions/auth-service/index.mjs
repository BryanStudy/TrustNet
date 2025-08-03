import { verifyAuth, ddbDocClient } from '/opt/nodejs/index.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;



// Simple email validation (replacing Zod)
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Login function
async function handleLogin(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password } = body;

    // Validate request body (matching Zod validation)
    const validationErrors = [];
    
    if (!email || !validateEmail(email)) {
      validationErrors.push('Invalid email format');
    }
    
    if (!password || password.length < 1) {
      validationErrors.push('Password is required');
    }
    
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: validationErrors.join(', ') }),
      };
    }

    // Query DynamoDB for user
    const command = new QueryCommand({
      TableName: 'users',
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
      Limit: 1,
    });
    
    const { Items } = await ddbDocClient.send(command);
    const user = Items && Items[0];

    if (!user || user.password !== password) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Invalid email or password.' }),
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
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(JWT_SECRET));

    // Return response matching Next.js structure
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': `token=${jwt}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict;`,
      },
      body: JSON.stringify({ user: { ...user, password: undefined } }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error in login endpoint:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: errorMessage }),
    };
  }
}

// Logout function
async function handleLogout() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Set-Cookie': 'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict;',
    },
    body: JSON.stringify({ success: true }),
  };
}

// Me function
async function handleMe(event) {
  let userPayload;

  try {
    userPayload = await verifyAuth(event);
  } catch {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Not authenticated' }),
    };
  }

  try {
    const userId = userPayload.userId;
    const command = new QueryCommand({
      TableName: 'users',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      Limit: 1,
    });
    
    const { Items } = await ddbDocClient.send(command);
    const user = Items && Items[0];

    if (!user) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    const { password, ...userWithoutPassword } = user;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ user: userWithoutPassword }),
    };
  } catch (error) {
    console.error('Error fetching user from DynamoDB:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

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
      // Login
      case "POST /login":
        const loginResult = await handleLogin(event);
        return loginResult;
        break;

      // Logout
      case "POST /logout":
        const logoutResult = await handleLogout();
        return logoutResult;
        break;

      // Get current user
      case "GET /me":
        const meResult = await handleMe(event);
        return meResult;
        break;

      // Handle OPTIONS for CORS
      case "OPTIONS /login":
      case "OPTIONS /logout":
      case "OPTIONS /me":
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,PATCH,OPTIONS",
          },
          body: JSON.stringify({ message: "CORS preflight" }),
        };
        break;

      default:
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: `Unsupported route: ${event.routeKey}` }),
        };
    }
  } catch (error) {
    console.error("Lambda error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}; 