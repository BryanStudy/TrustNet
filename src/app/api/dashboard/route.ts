import { NextRequest, NextResponse } from 'next/server';
import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import ddbDocClient from '@/utils/dynamodb';
import { verifyAuth } from "@/utils/auth";

export async function GET(req: NextRequest) {
  try {
    // Check if user is authenticated
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch only the data we actually need
    const [usersResult, reportsResult, threatsResult, articlesResult, likesResult] = await Promise.all([
      // Users data - only need for count and registration dates
      ddbDocClient.send(new ScanCommand({
        TableName: "users",
        ProjectionExpression: "userId, createdAt"
      })),
      
      // Scam reports data - only need for count
      ddbDocClient.send(new ScanCommand({
        TableName: "scam-reports",
        ProjectionExpression: "reportId"
      })),
      
      // Digital threats data - need for count and status distribution
      ddbDocClient.send(new ScanCommand({
        TableName: "digital-threats",
        ProjectionExpression: "threatId, #s",
        ExpressionAttributeNames: {
          "#s": "status"
        }
      })),
      
      // Articles data - only need for count
      ddbDocClient.send(new ScanCommand({
        TableName: "articles",
        ProjectionExpression: "articleId"
      })),
      
      // Threat likes data - only need for count
      ddbDocClient.send(new ScanCommand({
        TableName: "threat-likes",
        ProjectionExpression: "userId"
      }))
    ]);

    const users = usersResult.Items || [];
    const reports = reportsResult.Items || [];
    const threats = threatsResult.Items || [];
    const articles = articlesResult.Items || [];
    const likes = likesResult.Items || [];

    // 1. User registrations over time (last 6 months)
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        month: date.toISOString().slice(0, 7), // YYYY-MM format
        name: date.toLocaleDateString('en', { month: 'short', year: 'numeric' })
      };
    }).reverse();

    const userRegistrations = last6Months.map(month => {
      const count = users.filter(user => 
        user.createdAt && user.createdAt.startsWith(month.month)
      ).length;
      return { ...month, users: count };
    });

    // 2. Threat status distribution
    const threatsByStatus = threats.reduce((acc, threat) => {
      const status = threat.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const threatStatusData = Object.entries(threatsByStatus).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count
    }));

    // 3. Summary statistics
    const stats = {
      totalUsers: users.length,
      totalReports: reports.length,
      totalThreats: threats.length,
      totalArticles: articles.length,
      totalLikes: likes.length,
      verifiedThreats: threats.filter(t => t.status === 'verified').length,
      activeUsers: users.filter(user => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        return user.createdAt && new Date(user.createdAt) > oneMonthAgo;
      }).length
    };

    return NextResponse.json({
      userRegistrations,
      threatStatusData,
      stats
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
} 