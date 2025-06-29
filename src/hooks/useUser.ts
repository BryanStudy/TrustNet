'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import axios from '@/utils/axios';

// Only keep local user state and backend API calls

export type UserInfo = {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
    createdAt: string;
};

/**
 * Hook for managing user data and fetching user attributes.
 */
export function useUser() {
    const router = useRouter();
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/me');
            setUserInfo(res.data.user);
            console.log(res.data);
        } catch {
            // TODO: Handle this better
            
            setUserInfo(null); 
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    return { userInfo, loading, refetch: fetchUser };
} 