'use client';

import { useEffect, useState } from 'react';
import { useUser, useDeleteUser } from '@/hooks/useUser';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
    const { userInfo, loading, updateUser } = useUser();
    const deleteUser = useDeleteUser();
    const [givenName, setGivenName] = useState(userInfo?.given_name || '');
    const [familyName, setFamilyName] = useState(userInfo?.family_name || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    // Sync userInfo to form state once loaded
    useEffect(() => {
        if (userInfo) {
            setGivenName(userInfo.given_name || '');
            setFamilyName(userInfo.family_name || '');
        }
    }, [userInfo]);
    
    const handleSave = async () => {
        if (!isEditing) return;
        try {
            await updateUser({ given_name: givenName, family_name: familyName });
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update profile:', error);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!isDeleting) return;
        try {
            await deleteUser();
        } catch (error) {
            console.error('Failed to delete account:', error);
            setIsDeleting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 space-y-6">
                <div className="flex justify-between items-start">
                    <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
                    <button onClick={() => router.push('/landing')} className="text-sm text-blue-500 hover:underline">Back to Home</button>
                </div>
                <div className="flex items-center space-x-6">
                    <img
                        src={userInfo?.picture || '/default-avatar.png'}
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
                                    value={givenName}
                                    onChange={(e) => setGivenName(e.target.value)}
                                    className="w-full p-2 border rounded-md disabled:bg-gray-100"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-500">Last Name</label>
                                <input
                                    type="text"
                                    disabled={!isEditing}
                                    value={familyName}
                                    onChange={(e) => setFamilyName(e.target.value)}
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
                    <button onClick={() => setIsDeleting(true)} className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                        Delete Account
                    </button>
                </div>
            </div>
            {isDeleting && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
                    <div className="bg-white p-6 rounded-lg shadow-xl text-center">
                        <h2 className="text-xl font-bold mb-4">Are you sure?</h2>
                        <p className="mb-6">This action cannot be undone. All your data will be permanently deleted.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={handleDeleteConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                                Yes, delete my account
                            </button>
                            <button onClick={() => setIsDeleting(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 