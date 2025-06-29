import { NextRequest, NextResponse } from 'next/server';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import ddbDocClient from '@/utils/dynamodb';
import { SignJWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Validates if the provided email string matches a basic email format.
 */
function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Handles user signup by creating a new user in DynamoDB and generating a JWT.
 */
export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, password, picture, role } = await req.json();

    // Validate incoming data
    if (!firstName || typeof firstName !== 'string' ||
        !lastName || typeof lastName !== 'string' ||
        !email || typeof email !== 'string' ||
        !password || typeof password !== 'string' ||
        !picture || typeof picture !== 'string' ||
        !role) {
      return NextResponse.json({
        error: 'All fields (firstName, lastName, email, password, picture) are required and must be strings.'
      }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    // Check if user already exists
    const query = new QueryCommand({
      TableName: 'users',
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email },
      Limit: 1,
    });
    const { Items } = await ddbDocClient.send(query);

    if (Items && Items.length > 0) {
      return NextResponse.json({ error: 'User with this email already exists.' }, { status: 409 });
    }

    // Store user (plaintext password for now)
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
    await ddbDocClient.send(new PutCommand({
      TableName: 'users',
      Item: user,
    }));

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

    // Set JWT as HttpOnly cookie
    const response = NextResponse.json({ user: { ...user, password: undefined } });
    response.headers.set('Set-Cookie', `token=${jwt}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict;`);

    return response;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('Error in signup endpoint:', err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 