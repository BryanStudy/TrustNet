import { NextRequest, NextResponse } from 'next/server';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import ddbDocClient from '@/utils/dynamodb';
import { SignJWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET;

// User creation validation schema
const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name too long"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name too long"),
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain at least 1 number")
    .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special character"),
  picture: z.string().min(1, "Profile picture is required"),
  role: z.enum(["customer", "admin"], {
    errorMap: () => ({ message: "Role must be either 'customer' or 'admin'" }),
  }),
});

/**
 * Handles user signup by creating a new user in DynamoDB and generating a JWT.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate incoming data
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => err.message).join(', ');
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { firstName, lastName, email, password, picture, role } = validationResult.data;

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