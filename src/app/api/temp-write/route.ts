import { NextRequest, NextResponse } from 'next/server';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { verifyJwt } from '@/utils/auth';
import ddbDocClient from '@/utils/dynamodb';

export async function POST(req: NextRequest) {
  try {
    // Verify the user's token to ensure they are authenticated
    await verifyJwt(req);

    const tempId = randomUUID();
    const testData = { message: 'Hello from the test button!', timestamp: new Date().toISOString() };

    // Create a new item in the 'temp' table
    await ddbDocClient.send(new PutCommand({
      TableName: 'temp',
      Item: {
        tempId: tempId,
        ...testData
      }
    }));

    return NextResponse.json({ success: true, message: `Successfully wrote item ${tempId} to temp table.` });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('Error in temp-write endpoint:', err);

    if (errorMessage.includes('Authorization header is missing') || errorMessage.includes('Your session has expired')) {
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 