import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { ScamReport, ScamReportWithUserDetail } from "@/types/scam-reports";
import { UserInfo } from "@/hooks/useUser";
import { constructFileUrl } from "@/utils/fileUtils";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await context.params;
  const { searchParams } = new URL(req.url);
  const createdAt = searchParams.get("createdAt");

  if (!createdAt) {
    return NextResponse.json(
      { error: "createdAt is required" },
      { status: 400 }
    );
  }

  try {
    // Get the specific scam report
    const reportCommand = new GetCommand({
      TableName: "scam-reports",
      Key: {
        reportId,
        createdAt,
      },
    });

    const { Item } = await ddbDocClient.send(reportCommand);

    if (!Item) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const report: ScamReport = Item as ScamReport;

    // Get user info
    const userCommand = new GetCommand({
      TableName: "users",
      Key: {
        userId: report.userId,
      },
    });

    const { Item: userItem } = await ddbDocClient.send(userCommand);
    const user: UserInfo | undefined = userItem as UserInfo;

    // Map to ScamReportWithUserDetail
    const reportWithUserDetail: ScamReportWithUserDetail = {
      ...report,
      image: constructFileUrl(report.image, "scam-reports"),
      reporterName: user
        ? `${user.firstName} ${user.lastName}`
        : "Unknown User",
      reporterPicture: user
        ? constructFileUrl(user.picture, "profile-pictures")
        : "",
    };

    return NextResponse.json({
      report: reportWithUserDetail,
    });
  } catch (error) {
    console.error("Error fetching report with user detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}
