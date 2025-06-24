'use client';

import {
    deleteUser as amplifyDeleteUser,
    fetchUserAttributes,
    signOut,
    updateUserAttributes
} from 'aws-amplify/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import awsconfig from '@/config/aws-amplify-config';

type UserAttributes = {
    given_name: string;
    family_name: string;
    email: string;
    email_verified: "true"| "false";
    picture: string;
    sub: string;
};

type UpdateUserAttributes = {
    given_name?: string;
    family_name?: string;
}

/**
 * Hook for managing user data and fetching user attributes.
 */
export function useUser(isGoogle: boolean = false) {
    const router = useRouter();
    const [userInfo, setUserInfo] = useState<UserAttributes | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("useUser hook initialized, google account:", isGoogle);
        if (isGoogle) {
            setUserInfo({
                email_verified: 'true',
                given_name: 'Kit',
                family_name: 'Bryan',
                email: 'study.kitbryan@gmail.com',
                picture: "https://c.files.bbci.co.uk/6D3D/production/_110556972_3d119fbe-d415-4709-b604-440aadcb1fff.jpg",
                sub: "f4f82408-a0f1-701c-25db-d75344a0279e"
            });
            setLoading(false);
            return;
        }

        const getSession = async () => {
            try {
                const attributes = await fetchUserAttributes();
                setUserInfo(attributes as UserAttributes);
            } catch (error) {
                console.error('Failed to fetch user attributes:', error);
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };

        getSession();
    }, [router]);

    const updateUser = async (newAttributes: UpdateUserAttributes) => {
        try {
            // TODO: Are we using backend? Guess we are
            const response = await fetch('/api/user', {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(newAttributes),
            });

            if (!response.ok) throw new Error('Server error');
            // update in Cognito
            await updateUserAttributes({userAttributes: newAttributes});

            // Update the local state
            setUserInfo(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    ...newAttributes,
                } as UserAttributes;
            });

        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    };

    return {userInfo, loading, updateUser};
}

/**
 * Hook for handling user logout.
 */
export function useLogout() {
    const logout = async () => {
        try {
            await signOut();
            const domain = awsconfig.Auth.Cognito.loginWith.oauth.domain;
            const clientId = awsconfig.Auth.Cognito.userPoolClientId;
            const logoutUri = `${window.location.origin}/login`;
            window.location.href = `https://${domain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`;
        } catch (error) {
            console.log('error signing out: ', error);
        }
    };
    return logout;
}

/**
 * Hook for handling user account deletion.
 */
export function useDeleteUser() {
    const logout = useLogout();
    const deleteUser = async () => {
        try {
            await amplifyDeleteUser();
            await logout();
        } catch (error) {
            console.error('Error deleting user account:', error);
            throw error;
        }
    };
    return deleteUser;
} 