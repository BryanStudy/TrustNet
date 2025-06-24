import { NextRequest, NextResponse } from 'next/server';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { verifyJwt } from '@/utils/auth';
import ddbDocClient from '@/utils/dynamodb';

/**
 * Handles updating user information in DynamoDB.
 * @param {Request} request - The incoming request object.
 * @returns {NextResponse} A response object with the result.
 */
export async function PATCH(request: NextRequest) {
  try {
    const payload = await verifyJwt(request);
    const userId = payload.sub;

    if (!userId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 });
    }

    const { given_name, family_name } = await request.json();

    const command = new UpdateCommand({
      TableName: 'users',
      Key: { userId },
      UpdateExpression: 'set givenName = :gn, familyName = :fn',
      ExpressionAttributeValues: {
        ':gn': given_name,
        ':fn': family_name,
      },
      ReturnValues: 'ALL_NEW',
    });

    const { Attributes } = await ddbDocClient.send(command);

    return NextResponse.json({ message: 'User updated successfully', user: Attributes });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    console.error('Failed to update user:', err);

    if (errorMessage.includes('Authorization header is missing') || errorMessage.includes('Your session has expired')) {
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }

    return NextResponse.json({ message: 'Failed to update user' }, { status: 500 });
  }
} 