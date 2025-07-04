import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { ScamReport, ScamReportWithUserDetail } from "@/types/scam-reports";
import { UserInfo } from "@/hooks/useUser";
import { constructFileUrl } from "@/utils/fileUtils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "";
  const limit = parseInt(searchParams.get("limit") || "6", 10);
  const lastEvaluatedKeyParam = searchParams.get("lastEvaluatedKey");
  let lastEvaluatedKey = undefined;
  if (!title) {
    return NextResponse.json(
      { error: "Title is required for search" },
      { status: 400 }
    );
  }
  if (lastEvaluatedKeyParam) {
    try {
      lastEvaluatedKey = JSON.parse(lastEvaluatedKeyParam);
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid lastEvaluatedKey param" },
        { status: 400 }
      );
    }
  }

  try {
    // Query scam reports by title prefix
    const queryCommand = new QueryCommand({
      TableName: "scam-reports",
      IndexName: "viewable-title-index",
      KeyConditionExpression:
        "viewable = :viewable AND begins_with(title, :prefix)",
      ExpressionAttributeValues: {
        ":viewable": "REPORTS",
        ":prefix": title,
      },
      ScanIndexForward: false, // newest first (if you want oldest first, set to true)
      Limit: limit,
      ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
    });
    const { Items, LastEvaluatedKey } = await ddbDocClient.send(queryCommand);
    const reports: ScamReport[] = (Items || []) as ScamReport[];

    // Collect unique userIds
    const userIds = Array.from(new Set(reports.map((r) => r.userId)));

    // Batch get user info
    let userMap: Record<string, UserInfo> = {};
    if (userIds.length > 0) {
      const batchGetCommand = new BatchGetCommand({
        RequestItems: {
          users: {
            Keys: userIds.map((userId) => ({ userId })),
          },
        },
      });
      const batchResult = await ddbDocClient.send(batchGetCommand);
      const users: UserInfo[] = (batchResult.Responses?.users ||
        []) as UserInfo[];
      userMap = Object.fromEntries(users.map((u) => [u.userId, u]));
    }

    // Map reports to ScamReportWithUserDetail
    const reportsWithUserDetail: ScamReportWithUserDetail[] = reports.map(
      (report) => {
        const user = userMap[report.userId];
        return {
          ...report,
          image: constructFileUrl(report.image, "scam-reports"),
          reporterName: user
            ? `${user.firstName} ${user.lastName}`
            : "Unknown User",
          reporterPicture: user
            ? constructFileUrl(user.picture, "profile-pictures")
            : "",
        };
      }
    );

    return NextResponse.json({
      reports: reportsWithUserDetail,
      lastEvaluatedKey: LastEvaluatedKey || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to search reports" },
      { status: 500 }
    );
  }
}
