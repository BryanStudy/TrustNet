import { NextRequest, NextResponse } from 'next/server';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import ddbDocClient from '@/utils/dynamodb';
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Query DynamoDB for a user with the given email
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
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Create JWT
    const jwt = await new SignJWT({
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      picture: user.picture,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(JWT_SECRET));

    // Set JWT as HttpOnly cookie
    const response = NextResponse.json({user: { ...user, password: undefined } });
    response.headers.set('Set-Cookie', `token=${jwt}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict;`);

    return response;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('Error in login endpoint:', err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 