import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', 'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict;');
  return response;
} 