import { NextRequest, NextResponse } from 'next/server';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import ddbDocClient from '@/utils/dynamodb';
import { verifyAuth } from '@/utils/auth';

/**
 * Handles updating user information in DynamoDB.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // Authenticate user
  try {
    await verifyAuth(req);
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const userId = params.id;
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required in params' }, { status: 400 });
    }

    const { firstName, lastName } = await req.json();

    const command = new UpdateCommand({
      TableName: 'users',
      Key: { userId },
      UpdateExpression: 'set firstName = :fn, lastName = :ln',
      ExpressionAttributeValues: {
        ':fn': firstName,
        ':ln': lastName,
      },
      ReturnValues: 'ALL_NEW',
    });

    const { Attributes } = await ddbDocClient.send(command);
    return NextResponse.json({ message: 'User updated successfully', user: Attributes });
  } catch (err) {
    console.error('Failed to update user:', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
} 