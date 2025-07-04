import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { ScamReport } from "@/types/scam-reports";

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
    const command = new GetCommand({
      TableName: "scam-reports",
      Key: {
        reportId,
        createdAt,
      },
    });
    const { Item } = await ddbDocClient.send(command);
    if (!Item) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ report: Item as ScamReport });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}
