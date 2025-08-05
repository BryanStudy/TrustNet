import { NextRequest, NextResponse } from "next/server";
import { handleEmailUnsubscribe } from "@/utils/threatNotifications";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const userId = searchParams.get("userId");

    if (!token || !userId) {
      return NextResponse.json(
        { error: "Missing token or userId parameter" },
        { status: 400 }
      );
    }

    // Handle email unsubscribe
    await handleEmailUnsubscribe(userId, token);

    // Return a simple HTML page with confirmation
    const htmlResponse = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed - TrustNet</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px; 
              text-align: center; 
            }
            .success { color: #059669; }
            .card { 
              border: 1px solid #e5e7eb; 
              border-radius: 8px; 
              padding: 40px; 
              background: #f9fafb; 
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 class="success">✅ Successfully Unsubscribed</h1>
            <p>You have been unsubscribed from TrustNet threat verification notifications.</p>
            <p>You will no longer receive emails when your threats are verified.</p>
            <br>
            <p><a href="${process.env.NEXT_PUBLIC_APP_BASE_URL}">Return to TrustNet</a></p>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(htmlResponse, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error: any) {
    console.error("Error handling email unsubscribe:", error);

    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribe Error - TrustNet</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px; 
              text-align: center; 
            }
            .error { color: #dc2626; }
            .card { 
              border: 1px solid #e5e7eb; 
              border-radius: 8px; 
              padding: 40px; 
              background: #f9fafb; 
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 class="error">❌ Unsubscribe Failed</h1>
            <p>Sorry, we couldn't process your unsubscribe request.</p>
            <p>The link may be invalid or expired.</p>
            <br>
            <p><a href="${process.env.NEXT_PUBLIC_APP_BASE_URL}">Return to TrustNet</a></p>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(errorHtml, {
      status: 400,
      headers: {
        "Content-Type": "text/html",
      },
    });
  }
}
