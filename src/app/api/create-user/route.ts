import { NextRequest, NextResponse } from 'next/server';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { verifyJwt } from '@/utils/auth';
import ddbDocClient from '@/utils/dynamodb';

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyJwt(req);
    const { givenName, familyName, picture } = await req.json();

    // Validate incoming data
    if (!givenName || typeof givenName !== 'string' || 
        !familyName || typeof familyName !== 'string' || 
        !picture || typeof picture !== 'string') {
      return NextResponse.json({ 
        error: 'Missing or invalid fields. All fields (givenName, familyName, picture) are required and must be strings.' 
      }, { status: 400 });
    }

    if (!payload.sub || !payload.email) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 });
    }

    await ddbDocClient.send(new PutCommand({
      TableName: 'users',
      Item: {
        userId: payload.sub,
        email: payload.email,
        givenName,
        familyName,
        picture,
        createdAt: new Date().toISOString(),
      }
    }));

    return NextResponse.json({ success: true, message: 'User created successfully' });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('Error in create-user endpoint:', err);
    
    if (errorMessage.includes('Authorization header is missing') || errorMessage.includes('Your session has expired')) {
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 