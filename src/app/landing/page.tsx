'use client';

import { useUser, useLogout } from '@/hooks/useUser';
import Link from 'next/link';

export default function LandingPage() {
    const { userInfo, loading } = useUser();
    const logout = useLogout();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <p>Loading...</p>
            </div>
        );
    }
    console.log(userInfo);
    

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-4 text-center bg-white rounded-xl shadow-lg">
                {userInfo?.picture && (
                    <img
                        src={userInfo.picture}
                        alt="Profile"
                        className="w-24 h-24 mx-auto -mt-16 border-4 border-white rounded-full object-cover"
                    />

                )}
                <h1 className="text-3xl font-bold">Welcome, {userInfo?.given_name || 'User'}!</h1>
                <p className="text-gray-600">You have successfully signed in.</p>
                <div className="text-left pt-4 border-t">
                    <p className="text-sm"><strong className="font-medium">Email:</strong> {userInfo?.email}</p>
                    <p className="text-sm"><strong className="font-medium">First Name:</strong> {userInfo?.given_name}</p>
                    <p className="text-sm"><strong className="font-medium">Last Name:</strong> {userInfo?.family_name}</p>
                </div>
                <div className="flex space-x-4 justify-center">
                    <Link href="/profile">
                        <p className="w-full max-w-xs px-8 py-3 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-semibold cursor-pointer">
                            Edit Profile
                        </p>
                    </Link>
                    <button onClick={logout} className="w-full max-w-xs px-8 py-3 text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 font-semibold cursor-pointer">
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
} 