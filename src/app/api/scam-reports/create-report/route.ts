import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { verifyAuth } from "@/utils/auth";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import ddbDocClient from "@/utils/dynamodb";
import { createScamReportSchema } from "@/schema/scam-reports";
import { ScamReport } from "@/types/scam-reports";

export async function POST(req: NextRequest) {
  let userPayload;
  try {
    userPayload = await verifyAuth(req);
  } catch (error) {
    return NextResponse.json(
      { error: "User is not authenticated" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const validationResult = createScamReportSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.message },
        { status: 400 }
      );
    }

    const reportId = uuidv4();
    const userId = userPayload.userId as string;
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;
    const viewable = "REPORTS";

    const newReport: ScamReport = {
      reportId,
      userId,
      title: body.title,
      description: body.description,
      anonymized: body.anonymized,
      image: body.image,
      createdAt,
      updatedAt,
      viewable,
    };

    const putScamReportCommand = new PutCommand({
      TableName: "scam-reports",
      Item: newReport,
    });
    await ddbDocClient.send(putScamReportCommand);

    return NextResponse.json(
      { message: "Scam report created successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating scam report:", error);
    return NextResponse.json(
      { error: "Failed to create scam report" },
      { status: 500 }
    );
  }
}
