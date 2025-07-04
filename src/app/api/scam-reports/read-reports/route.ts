import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { ScamReport, ScamReportWithUserDetail } from "@/types/scam-reports";
import { UserInfo } from "@/hooks/useUser";
import { constructFileUrl } from "@/utils/fileUtils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "6", 10);
  const lastEvaluatedKeyParam = searchParams.get("lastEvaluatedKey");
  let lastEvaluatedKey = undefined;
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
    // Fetch limit+1 items to check if there is a next page
    const queryCommand = new QueryCommand({
      TableName: "scam-reports",
      IndexName: "viewable-createdAt-index",
      KeyConditionExpression: "viewable = :viewable",
      ExpressionAttributeValues: { ":viewable": "REPORTS" },
      ScanIndexForward: false, // newest first
      Limit: limit + 1,
      ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
    });
    const { Items } = await ddbDocClient.send(queryCommand);
    let reports: ScamReport[] = (Items || []) as ScamReport[];
    let nextEvaluatedKey = null;
    if (reports.length > limit) {
      // There is a next page
      const lastItem = reports[limit - 1];
      // Only return the first 'limit' items
      reports = reports.slice(0, limit);
      nextEvaluatedKey = {
        reportId: lastItem.reportId,
        createdAt: lastItem.createdAt,
        viewable: "REPORTS",
      };
    }

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
      lastEvaluatedKey: nextEvaluatedKey,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
