import { Suspense } from 'react';
import LandingPageClient from './LandingPageClient';

export default function LandingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex justify-center items-center">Loading...</div>}>
            <LandingPageClient />
        </Suspense>
    );
}
