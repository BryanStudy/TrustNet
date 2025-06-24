import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { NextRequest } from 'next/server';

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const region = process.env.NEXT_PUBLIC_AWS_REGION;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;

if (!userPoolId || !region || !userPoolClientId) {
  throw new Error('Missing Cognito environment variables for JWT verification.');
}

const jwksUrl = new URL(`https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`);
const JWKS = createRemoteJWKSet(jwksUrl);

/**
 * Verifies a JWT from an Authorization header in a Next.js API route.
 * @param request The NextRequest object from the API route handler.
 * @returns The verified JWT payload.
 * @throws An error if the token is missing, malformed, or invalid.
 */
export async function verifyJwt(request: NextRequest): Promise<JWTPayload> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    throw new Error('Authorization header is missing.');
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      audience: userPoolClientId,
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification Error:', error);
    throw new Error('Your session has expired. Please log in again.');
  }
} 