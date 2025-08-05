import { SubscribeCommand, PublishCommand } from "@aws-sdk/client-sns";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import snsClient from "@/utils/snsClient";
import ddbDocClient from "@/utils/dynamodb";

const TOPIC_ARN = process.env.AWS_SNS_TOPIC_ARN;

if (!TOPIC_ARN) {
  throw new Error("AWS_SNS_TOPIC_ARN environment variable is not set");
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
 * Auto-subscribe user to threat verification notifications
 * Called on every threat creation - SNS handles duplicates gracefully
 */
export async function autoSubscribeUser(email: string): Promise<void> {
  try {
    const subscribeCommand = new SubscribeCommand({
      TopicArn: TOPIC_ARN,
      Protocol: "email",
      Endpoint: email,
    });

    const result = await snsClient.send(subscribeCommand);
    console.log(
      `Auto-subscribed ${email} to threat notifications. ARN: ${result.SubscriptionArn}`
    );
  } catch (error) {
    // Don't throw - threat creation should succeed even if subscription fails
    console.error("Error auto-subscribing user:", error);
  }
}

/**
 * Send threat verification notification (always try to send)
 * SNS will only deliver to confirmed subscribers
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

    // Simplified email template (no custom unsubscribe)
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
The TrustNet Team`;

    // Always try to send - SNS handles delivery to confirmed subscribers only
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
    // Don't throw - verification should succeed even if notification fails
    console.error("Error sending verification notification:", error);
  }
}
