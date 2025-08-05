import {
  SubscribeCommand,
  PublishCommand,
  UnsubscribeCommand,
} from "@aws-sdk/client-sns";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import snsClient from "@/utils/snsClient";
import ddbDocClient from "@/utils/dynamodb";

const TOPIC_ARN = process.env.AWS_SNS_TOPIC_ARN;
const SUBSCRIPTIONS_TABLE = "threat-notification-subscriptions";

if (!TOPIC_ARN) {
  throw new Error("AWS_SNS_TOPIC_ARN environment variable is not set");
}

export interface SubscriptionStatus {
  subscribed: boolean;
  email?: string;
  subscriptionArn?: string;
}

export interface ThreatDetails {
  threatId: string;
  artifact: string;
  description: string;
  type: "email" | "phone" | "url";
  submittedBy: string;
  createdAt: string;
}

/**
 * Check if user has an active global subscription
 */
export async function getUserSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  try {
    const command = new GetCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Key: { userId },
    });

    const { Item } = await ddbDocClient.send(command);

    if (!Item) {
      return { subscribed: false };
    }

    return {
      subscribed: Item.subscribed === true,
      email: Item.email,
      subscriptionArn: Item.subscriptionArn,
    };
  } catch (error) {
    console.error("Error checking subscription status:", error);
    return { subscribed: false };
  }
}

/**
 * Subscribe user globally to threat verification notifications
 */
export async function subscribeUserGlobally(
  userId: string,
  email: string
): Promise<void> {
  try {
    // Check if user already has a subscription record
    const existingStatus = await getUserSubscriptionStatus(userId);

    if (existingStatus.subscribed) {
      console.log(`User ${userId} is already subscribed`);
      return;
    }

    // Subscribe to SNS topic
    const subscribeCommand = new SubscribeCommand({
      TopicArn: TOPIC_ARN,
      Protocol: "email",
      Endpoint: email,
    });

    const subscribeResult = await snsClient.send(subscribeCommand);
    const subscriptionArn = subscribeResult.SubscriptionArn;

    if (!subscriptionArn) {
      throw new Error("Failed to get subscription ARN from SNS");
    }

    // Generate unsubscribe token
    const unsubscribeToken = uuidv4();

    // Store subscription in DynamoDB
    const putCommand = new PutCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Item: {
        userId,
        email,
        subscriptionArn,
        subscribed: true,
        unsubscribeToken,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    await ddbDocClient.send(putCommand);
    console.log(
      `User ${userId} subscribed successfully to threat notifications`
    );
  } catch (error) {
    console.error("Error subscribing user:", error);
    throw new Error("Failed to subscribe to notifications");
  }
}

/**
 * Toggle user's global subscription (enable/disable)
 */
export async function toggleUserSubscription(
  userId: string,
  enabled: boolean
): Promise<void> {
  try {
    const command = new UpdateCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      Key: { userId },
      UpdateExpression: "SET subscribed = :subscribed, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":subscribed": enabled,
        ":updatedAt": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(userId)", // Ensure record exists
    });

    await ddbDocClient.send(command);
    console.log(`User ${userId} subscription toggled to: ${enabled}`);
  } catch (error) {
    console.error("Error toggling subscription:", error);
    throw new Error("Failed to update subscription status");
  }
}

/**
 * Send threat verification notification to user
 */
export async function sendVerificationNotification(
  threatId: string,
  createdAt: string
): Promise<void> {
  try {
    // Get threat details
    const threatCommand = new GetCommand({
      TableName: "digital-threats",
      Key: { threatId, createdAt },
    });

    const threatResult = await ddbDocClient.send(threatCommand);
    if (!threatResult.Item) {
      throw new Error(`Threat not found: ${threatId}`);
    }

    const threat = threatResult.Item as ThreatDetails;

    // Get user details
    const userCommand = new GetCommand({
      TableName: "users",
      Key: { userId: threat.submittedBy },
    });

    const userResult = await ddbDocClient.send(userCommand);
    if (!userResult.Item) {
      throw new Error(`User not found: ${threat.submittedBy}`);
    }

    const user = userResult.Item;

    // Check if user has active subscription
    const subscriptionStatus = await getUserSubscriptionStatus(
      threat.submittedBy
    );
    if (!subscriptionStatus.subscribed) {
      console.log(
        `User ${threat.submittedBy} is not subscribed to notifications`
      );
      return;
    }

    // Prepare email content
    const subject = "✅ Your TrustNet threat report has been verified";
    const message = `Hi ${user.firstName},

Great news! Your digital threat report has been verified by our admin team.

Threat Details:
📋 Artifact: ${threat.artifact}
🔗 Type: ${threat.type.toUpperCase()}
📝 Description: ${threat.description}
✅ Status: Verified

Your contribution helps keep our community safe from digital threats!

Best regards,
The TrustNet Team

---
Don't want these notifications? Unsubscribe here: ${
      process.env.NEXT_PUBLIC_APP_BASE_URL
    }/api/notifications/unsubscribe-email?token=${
      subscriptionStatus.subscriptionArn
    }&userId=${threat.submittedBy}`;

    // Send notification
    const publishCommand = new PublishCommand({
      TopicArn: TOPIC_ARN,
      Subject: subject,
      Message: message,
      MessageAttributes: {
        threatId: {
          DataType: "String",
          StringValue: threatId,
        },
        userId: {
          DataType: "String",
          StringValue: threat.submittedBy,
        },
        email: {
          DataType: "String",
          StringValue: user.email,
        },
      },
    });

    await snsClient.send(publishCommand);
    console.log(
      `Verification notification sent for threat ${threatId} to ${user.email}`
    );
  } catch (error) {
    console.error("Error sending verification notification:", error);
    throw new Error("Failed to send notification");
  }
}

/**
 * Handle email unsubscribe (from email link)
 */
export async function handleEmailUnsubscribe(
  userId: string,
  token: string
): Promise<void> {
  try {
    // Verify the token matches the user's subscription
    const subscriptionStatus = await getUserSubscriptionStatus(userId);

    if (
      !subscriptionStatus.subscribed ||
      subscriptionStatus.subscriptionArn !== token
    ) {
      throw new Error("Invalid unsubscribe token");
    }

    // Soft unsubscribe (keep record but mark as unsubscribed)
    await toggleUserSubscription(userId, false);

    console.log(`User ${userId} unsubscribed via email link`);
  } catch (error) {
    console.error("Error handling email unsubscribe:", error);
    throw new Error("Failed to unsubscribe");
  }
}
