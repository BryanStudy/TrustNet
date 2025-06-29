'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import axios from '@/utils/axios';
import { toast } from 'react-toastify';
import { Spinner } from '@/components/spinner';

export default function LandingPage() {
    const router = useRouter();
    const { userInfo, loading, refetch } = useUser();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Spinner size="medium" className="mr-2" />
            </div>
        );
    }
    

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
                <h1 className="text-3xl font-bold">Welcome, {userInfo?.firstName || 'User'}!</h1>
                <p className="text-gray-600">You have successfully signed in.</p>
                <div className="text-left pt-4 border-t">
                    <p className="text-sm"><strong className="font-medium">Email:</strong> {userInfo?.email}</p>
                    <p className="text-sm"><strong className="font-medium">First Name:</strong> {userInfo?.firstName}</p>
                    <p className="text-sm"><strong className="font-medium">Last Name:</strong> {userInfo?.lastName}</p>
                </div>
                <div className="flex space-x-4 justify-center">
                    <Link href="/profile">
                        <p className="w-full max-w-xs px-8 py-3 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-semibold cursor-pointer">
                            Edit Profile
                        </p>
                    </Link>
                    <button
                        onClick={async () => {
                            await axios.post('/api/logout');
                            router.push('/');
                            toast.success('Logged out successfully');
                        }}
                        className="w-full max-w-xs px-8 py-3 text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 font-semibold cursor-pointer"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
