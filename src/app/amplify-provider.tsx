'use client';

import { Amplify } from 'aws-amplify';
import awsconfig from '@/config/aws-amplify-config';

// Configure Amplify for both server and client side
Amplify.configure(awsconfig, { ssr: true }); // ssr is optional, in case we wanna use SSRContext

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
