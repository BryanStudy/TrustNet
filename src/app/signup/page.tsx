'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import axios from '@/utils/axios';
import ProfilePictureUploader from '@/components/profile-picture-uploader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

const passwordRequirements = [
  { regex: /.{8,}/, text: 'At least 8 characters' },
  { regex: /[0-9]/, text: 'Contains at least 1 number' },
  { regex: /[a-z]/, text: 'Contains at least 1 lowercase letter' },
  { regex: /[A-Z]/, text: 'Contains at least 1 uppercase letter' },
  { regex: /[^A-Za-z0-9]/, text: 'Contains at least 1 special character' },
];

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [picture, setPicture] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async () => {
    setError(null);
    // Frontend validation
    if (!email || !firstName || !lastName || !picture || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Invalid email format.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    // All password requirements must be met
    const unmet = passwordRequirements.filter(req => !req.regex.test(password));
    if (unmet.length > 0) {
      setError('Password does not meet the requirements.');
      return;
    }
    try {
      await axios.post('/users', {
        firstName,
        lastName,
        picture,
        email,
        password,
        role: 'customer'
      });
      router.push('/digital-threats');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user in database.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--c-silver)] p-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">Sign Up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSignUp(); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  placeholder="First Name"
                  className="w-full px-4 py-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--c-violet)]"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  placeholder="Last Name"
                  className="w-full px-4 py-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--c-violet)]"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full px-4 py-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--c-violet)]"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--c-violet)] pr-12"
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
              <label className="text-sm font-medium text-gray-700">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--c-violet)] pr-12"
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
            <div>
              <label className="text-sm font-medium text-gray-700">Profile Picture</label>
              <div className="mt-1">
                <ProfilePictureUploader
                  folderPath="profile-pictures"
                  sizeLimit={1024 * 1024 * 5} // 5MB
                  onUploadComplete={(fileName) => setPicture(fileName)}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button
              type="submit"
              className="w-full py-3 text-white bg-[var(--c-violet)] rounded-lg hover:bg-[var(--c-violet)]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--c-violet)] font-semibold cursor-pointer"
            >
              Sign Up
            </button>
          </form>
          <p className="text-sm text-center text-gray-600">
            Already have an account?{' '}
            <a className="font-medium text-[var(--c-violet)] hover:underline" href="/">
              Sign In
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
