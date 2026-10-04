'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export default function TeacherLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // First Login states
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data;
      const textResponse = await res.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error(`Server error: ${textResponse.slice(0, 50)}`);
      }

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      if (data.requirePasswordChange) {
        setRequirePasswordChange(true);
        setTempToken(data.tempToken);
        setLoading(false);
        return;
      }

      if (data.role !== 'TEACHER' && data.role !== 'ADMIN') {
        setError('This account is not a teacher account');
        setLoading(false);
        return;
      }

      // Store auth data
      localStorage.setItem('teacherToken', data.token);
      localStorage.setItem('teacherName', data.name);
      localStorage.setItem('teacherEmail', data.email);
      localStorage.setItem('teacherId', data.id);
      if (data.officialId) localStorage.setItem('teacherOfficialId', data.officialId);

      // Navigate to dashboard
      router.push('/teacher/dashboard');
    } catch (err) {
      setError('Network error. Make sure the backend is running.');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse: any) => {
    try {
      setLoading(true);
      setError('');
      
      const res = await fetch('http://localhost:5000/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: credentialResponse.credential,
          role: 'TEACHER'
        })
      });

      let data;
      const textResponse = await res.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error(`Server error: ${textResponse.slice(0, 50)}`);
      }
      if (!res.ok) throw new Error(data?.error || 'Google Login failed');

      if (data.requirePasswordChange) {
        setRequirePasswordChange(true);
        setTempToken(data.tempToken);
        return;
      }

      if (data.role !== 'TEACHER' && data.role !== 'ADMIN') {
        throw new Error('This account is not a teacher account');
      }

      localStorage.setItem('teacherToken', data.token);
      localStorage.setItem('teacherName', data.name);
      localStorage.setItem('teacherEmail', data.email);
      localStorage.setItem('teacherId', data.id);
      if (data.officialId) localStorage.setItem('teacherOfficialId', data.officialId);
      router.push('/teacher/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/change-password-first-login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify({ newPassword })
      });

      let data;
      const textResponse = await res.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error(`Server error: ${textResponse.slice(0, 50)}`);
      }
      if (!res.ok) throw new Error(data?.error || 'Password change failed');

      localStorage.setItem('teacherToken', data.token);
      localStorage.setItem('teacherName', data.name);
      localStorage.setItem('teacherEmail', data.email);
      localStorage.setItem('teacherId', data.id);
      if (data.officialId) localStorage.setItem('teacherOfficialId', data.officialId);
      
      router.push('/teacher/dashboard');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-8 rounded-2xl relative glow-border max-w-md w-full">
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
          <User className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Teacher Login</h2>
        <p className="text-foreground/60 text-sm mt-2 text-center">Enter your credentials to access the portal</p>
      </div>

      {/* Demo credentials hint */}
      <div className="mb-6 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
        <strong>Demo Account:</strong> teacher@campusmind.ai / teacher123
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
        >
          <AlertCircle size={16} />
          {error}
        </motion.div>
      )}

      {requirePasswordChange ? (
        <form className="space-y-4" onSubmit={handlePasswordChange}>
          <div className="text-center mb-4 text-blue-400 font-medium">
            First login requires a password change.
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1">New Password</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500 transition-colors" 
              placeholder="••••••••" 
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1">Confirm New Password</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500 transition-colors" 
              placeholder="••••••••" 
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold transition-all mt-6 shadow-lg shadow-blue-500/25 cursor-pointer ${
              loading ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Updating...
              </span>
            ) : (
              'Set Password & Login'
            )}
          </button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1">Email or Official ID</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="teacher@malphor.ai or TCH24..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500 transition-colors pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold transition-all mt-6 shadow-lg shadow-blue-500/25 cursor-pointer ${
              loading ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
          
          <div className="mt-4 flex flex-col items-center gap-4">
            <div className="text-sm text-foreground/60">Or continue with</div>
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={() => setError('Google Login Failed')}
              theme="filled_black"
              shape="pill"
            />
          </div>
        </form>
      )}

      <div className="mt-6 pt-6 border-t border-foreground/10 text-center">
        <p className="text-foreground/60 text-sm">
          Don&apos;t have an account? <Link href="/teacher/register" className="text-blue-400 hover:underline font-medium">Register here</Link>
        </p>
      </div>
    </motion.div>
  );
}
