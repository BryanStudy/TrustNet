'use client';

import { getCurrentUser, signIn, signInWithRedirect } from 'aws-amplify/auth';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C39.901,36.639,44,30.833,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
    </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      try {
        await getCurrentUser();
        router.push('/landing');
      } catch (err) {
        // user is not signed in
      }
    };
    checkUser();
  }, [router]);

  const handleSignIn = async () => {
    setError(null);
    try {
      const { isSignedIn } = await signIn({ username: email, password });
      if (isSignedIn) {
        router.push('/landing');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithRedirect({ provider: 'Google' });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center">Sign In</h1>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSignIn(); }}>
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input type="email" placeholder="your@email.com" className="w-full px-4 py-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input type="password" placeholder="••••••••" className="w-full px-4 py-3 mt-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button type="submit" className="w-full py-3 text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-semibold cursor-pointer">Sign In</button>
        </form>

        <div className="flex items-center justify-center space-x-2">
            <hr className="flex-grow border-gray-300" />
            <span className="text-gray-400 text-sm">or</span>
            <hr className="flex-grow border-gray-300" />
        </div>

        <button onClick={handleGoogleSignIn} className="w-full flex items-center justify-center py-3 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 cursor-pointer">
            <GoogleIcon />
            <span className="font-semibold text-gray-700">Sign in with Google</span>
        </button>

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
