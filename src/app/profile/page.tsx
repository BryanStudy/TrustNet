'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { useRouter } from 'next/navigation';
import axios from '@/utils/axios';
import { Spinner } from '@/components/spinner';
import { toast } from 'sonner';
import { constructFileUrl } from '@/utils/fileUtils';

interface UserInfo {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    picture?: string;
}

export default function ProfilePage() {
    const { userInfo, loading, refetch } = useUser();
    const [firstName, setFirstName] = useState(userInfo?.firstName || '');
    const [lastName, setLastName] = useState(userInfo?.lastName || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (userInfo) {
            setFirstName(userInfo.firstName || '');
            setLastName(userInfo.lastName || '');
        }
    }, [userInfo]);

    const handleSave = async () => {
        if (!isEditing) return;
        setError(null);
        setSuccess(null);
        try {
            await axios.patch(`/api/users/${userInfo?.userId}`, {
                firstName,
                lastName,
            });
            setIsEditing(false);
            toast.success('Profile updated successfully.');
            refetch();
        } catch (error: any) {
            toast.error('Failed to update profile');
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <Spinner size="medium" className="mr-2" />
        </div>
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 space-y-6">
                <div className="flex justify-between items-start">
                    <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
                    <button onClick={() => router.push('/home')} className="text-sm text-blue-500 hover:underline">Back to Home</button>
                </div>
                <div className="flex items-center space-x-6">
                    <img
                        src={userInfo?.picture ? constructFileUrl(userInfo.picture, "profile-pictures") : '/default-avatar.png'}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                    />
                    <div className="flex-grow">
                        <div className="space-y-2">
                            <div>
                                <label className="text-sm font-medium text-gray-500">First Name</label>
                                <input
                                    type="text"
                                    disabled={!isEditing}
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full p-2 border rounded-md disabled:bg-gray-100"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-500">Last Name</label>
                                <input
                                    type="text"
                                    disabled={!isEditing}
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full p-2 border rounded-md disabled:bg-gray-100"
                                />
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Email: {userInfo?.email}</p>
                    </div>
                </div>

                <div className="pt-6 border-t flex justify-between items-center">
                    {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                            Edit Profile
                        </button>
                    ) : (
                        <div className="flex gap-4">
                            <button onClick={handleSave} className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                                Save
                            </button>
                            <button onClick={() => setIsEditing(false)} className="px-6 py-2 bg-gray-300 text-black rounded-lg hover:bg-gray-400">
                                Cancel
                            </button>
                        </div>
                    )}
                    {/* Delete Account button can be added here if needed */}
                </div>
            </div>
            {/* Delete confirmation modal can be added here if needed */}
        </div>
    );
} 