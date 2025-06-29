import { jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

export async function verifyAuth(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  if (!token) throw new Error('Not authenticated');
  const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
  return payload;
}
