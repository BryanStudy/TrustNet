'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from '@/utils/axios';
import { toast } from 'react-toastify';
import { Spinner } from '@/components/spinner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async () => {
    setError(null);
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/login', { email, password });
      router.push('/home');
      toast.success('Logged in successfully');
    } catch (err: any) {
      toast.error('Login failed');
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center">Sign In</h1>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSignIn(); }}>
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              className="w-full px-4 py-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-semibold cursor-pointer flex items-center justify-center"
            disabled={loading}
          >
            {loading ? <Spinner size="small" className="mr-2" /> : 'Sign In'}
          </button>
        </form>
        <p className="text-sm text-center text-gray-600">
          Don't have an account?{' '}
          <a className="font-medium text-blue-500 hover:underline" href="/signup">
            Sign Up
          </a>
        </p>
      </div>
    </div>
  );
}
