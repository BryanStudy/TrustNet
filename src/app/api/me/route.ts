import { NextRequest, NextResponse } from 'next/server';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import ddbDocClient from '@/utils/dynamodb';
import { verifyAuth } from '@/utils/auth';

export async function GET(req: NextRequest) {
  let userPayload;

  try {
    userPayload = await verifyAuth(req);
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { password, ...userWithoutPassword } = user;
    
    return NextResponse.json({ user: userWithoutPassword });
  } catch (err) {
    console.error('Error fetching user from DynamoDB:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 