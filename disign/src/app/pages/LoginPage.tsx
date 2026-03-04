import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { useStore } from '../store';
import { EyeFollowCharacters, type CharacterState } from '../components/EyeFollowCharacters';

export function LoginPage() {
  const navigate = useNavigate();
  const setUser = useStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [charState, setCharState] = useState<CharacterState>('idle');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setCharState('success');
    setTimeout(() => {
      setUser({ name: email || 'Student', role: 'student' });
      navigate('/dashboard');
    }, 1200);
  };

  const handleGoogleLogin = () => {
    setCharState('success');
    setTimeout(() => {
      setUser({ name: 'Google User', role: 'student' });
      navigate('/dashboard');
    }, 1200);
  };

  return (
    <div className="flex w-full h-full items-center justify-center bg-[#1a1a2e] p-4">
      <div className="flex w-full max-w-[1100px] h-[660px] rounded-3xl overflow-hidden shadow-2xl">
        {/* Left — Dark panel with characters */}
        <div className="hidden lg:flex flex-1 items-end justify-center bg-[#1e1e2f] relative px-8 pb-0">
          <div className="w-full max-w-[420px] mb-0">
            <EyeFollowCharacters state={charState} />
          </div>
        </div>

        {/* Right — White form card */}
        <div className="w-full lg:w-[480px] bg-white flex flex-col items-center justify-center px-10 py-8 rounded-3xl lg:rounded-l-none">
          {/* Cross / plus icon */}
          <div className="mb-6">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 2V26" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M2 14H14" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M14 14L24 8" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M14 14L24 20" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">Welcome back!</h1>
          <p className="text-gray-400 text-sm mb-8 text-center">Please enter your details</p>

          <form onSubmit={handleLogin} className="w-full max-w-[340px] space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setCharState('email')}
                onBlur={() => setCharState('idle')}
                className="w-full pb-2 border-b border-gray-300 text-sm outline-none focus:border-gray-500 transition-colors bg-transparent"
                placeholder=""
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setCharState('password')}
                  onBlur={() => setCharState('idle')}
                  className="w-full pb-2 border-b border-gray-300 text-sm outline-none focus:border-gray-500 transition-colors bg-transparent pr-8"
                  placeholder=""
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 bottom-2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 accent-gray-900"
                />
                <span className="text-xs text-gray-500">Remember for 30 days</span>
              </label>
              <button type="button" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Forgot password?
              </button>
            </div>

            {/* Log In */}
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#333] transition-colors"
            >
              Log In
            </button>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Log in with Google
            </button>
          </form>

          {/* Sign up link */}
          <p className="mt-8 text-xs text-gray-400">
            Don't have an account?{' '}
            <button className="text-gray-700 font-medium hover:underline">Sign Up</button>
          </p>
        </div>
      </div>
    </div>
  );
}
