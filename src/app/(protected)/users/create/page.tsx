'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import { ImageIcon, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { constructFileUrl } from '@/utils/fileUtils';
import { toast } from 'sonner';
import { Spinner } from '@/components/spinner';
import { useImageUpload, isValidEmail, passwordRequirements, validatePassword } from '@/hooks/useUser';
import axios from '@/utils/axios';

export default function CreateUserPage() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [picture, setPicture] = useState('');
  const [role, setRole] = useState<'customer' | 'admin'>('customer');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // Use the reusable image upload hook
  const { imageUploading, imageError, uploadImage, removeImage, validateImageFile } = useImageUpload("profile-pictures");

  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : firstName
    ? firstName[0].toUpperCase()
    : lastName
    ? lastName[0].toUpperCase()
    : "?";

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateImageFile(file)) return;
    
    const fileName = await uploadImage(file);
    if (fileName) {
      setPicture(fileName);
    }
  }

  async function handleRemoveImage() {
    if (!picture) return;
    const success = await removeImage(picture);
    if (success) {
      setPicture("");
    }
  }

  const handleCreateUser = async () => {
    setError(null);
    setIsCreating(true);
    
    // Frontend validation
    if (!email || !firstName || !lastName || !picture || !password || !confirmPassword || !role) {
      setError('All fields are required.');
      setIsCreating(false);
      return;
    }
    if (!isValidEmail(email)) {
      setError('Invalid email format.');
      setIsCreating(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsCreating(false);
      return;
    }
    // All password requirements must be met
    if (!validatePassword(password)) {
      setError('Password does not meet the requirements.');
      setIsCreating(false);
      return;
    }
    
    try {
      await axios.post('/api/users/admin-create', {
        firstName,
        lastName,
        picture,
        email,
        password,
        role
      });
      toast.success('User created successfully');
      router.push('/users');
    } catch (err: any) {
      let apiError = err?.response?.data?.error || err?.message || 'Failed to create user';
      if (Array.isArray(apiError)) {
        apiError = apiError.map((e: any) => e.message || String(e)).join(' | ');
      } else if (typeof apiError === 'object' && apiError.errors) {
        apiError = apiError.errors.map((e: any) => e.message).join(' | ');
      }
      setError(apiError);
      toast.error(apiError);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-md mt-10">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-3xl text-center">Create New User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="relative w-32 h-32 mx-auto mb-6">
            <Avatar className="w-full h-full rounded-2xl">
              {picture ? (
                <AvatarImage
                  src={constructFileUrl(picture, "profile-pictures")}
                  alt={`${firstName} ${lastName}`}
                  className="object-cover w-full h-full rounded-2xl"
                />
              ) : null}
              <AvatarFallback className="bg-[var(--c-mauve)] text-[var(--c-violet)] text-2xl font-mono rounded-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="absolute -bottom-2 -right-2 flex gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                ref={fileInputRef}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
                className="bg-white shadow-md cursor-pointer"
              >
                {imageUploading ? (
                  <Spinner size="small" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
              </Button>
              {picture && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveImage}
                  className="shadow-md cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleCreateUser(); }}>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-mono-bold text-gray-700 mb-1 text-left">
                  First Name
                </label>
                <input
                  type="text"
                  placeholder="First Name"
                  className="font-sans-bold text-xl w-full border rounded-md px-3 py-2 text-center"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-mono-bold text-gray-700 mb-1 text-left">
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="Last Name"
                  className="font-sans-bold text-xl w-full border rounded-md px-3 py-2 text-center"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-mono-bold text-gray-700 mb-1 text-left">
                Email Address
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                className="font-mono text-base w-full border rounded-md px-3 py-2"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-mono-bold text-gray-700 mb-1 text-left">
                User Role
              </label>
              <Select value={role} onValueChange={(value: 'customer' | 'admin') => setRole(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-mono-bold text-gray-700 mb-1 text-left">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="font-mono text-base w-full border rounded-md px-3 py-2 pr-12"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div className="pt-2">
                {passwordRequirements.map((req, index) => (
                  <div key={index} className={`flex items-center text-sm ${req.regex.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
                    <CheckCircleIcon className={`w-5 h-5 mr-2 ${req.regex.test(password) ? 'text-green-500' : 'text-gray-300'}`} />
                    {req.text}
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-mono-bold text-gray-700 mb-1 text-left">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="font-mono text-base w-full border rounded-md px-3 py-2 pr-12"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            
            <div className="flex gap-2 justify-center pt-4">
              <Button
                type="submit"
                className="bg-[var(--c-violet)] hover:bg-[var(--c-violet)]/80 text-white font-semibold cursor-pointer"
                disabled={isCreating || imageUploading}
              >
                {isCreating ? 'Creating...' : 'Create User'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => router.push('/users')}
                disabled={isCreating || imageUploading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 