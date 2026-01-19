'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, Users, Settings, Monitor, Zap } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        // Validation
        if (!email || !password) {
            setError('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        if (mode === 'signup' && password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        if (password.length < 6) {
            setError('비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        try {
            setIsLoading(true);
            const supabase = createClient();

            if (mode === 'signup') {
                // Sign up
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                });

                if (error) throw error;

                setSuccess('회원가입이 완료되었습니다! 이메일을 확인해주세요.');
                setEmail('');
                setPassword('');
                setConfirmPassword('');
            } else {
                // Login
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;

                router.push('/');
                router.refresh();
            }
        } catch (err) {
            console.error('Auth error:', err);
            if (err.message.includes('Invalid login credentials')) {
                setError('이메일 또는 비밀번호가 올바르지 않습니다.');
            } else if (err.message.includes('User already registered')) {
                setError('이미 등록된 이메일입니다.');
            } else {
                setError(err.message || '인증 중 오류가 발생했습니다.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setIsGoogleLoading(true);
            setError(null);

            const supabase = createClient();

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) throw error;
        } catch (err) {
            console.error('Google login error:', err);
            setError(err.message || 'Google 로그인 중 오류가 발생했습니다.');
            setIsGoogleLoading(false);
        }
    };

    const handleDemoLogin = async (demoEmail, demoPassword) => {
        try {
            setIsLoading(true);
            setError(null);

            setEmail(demoEmail);
            setPassword(demoPassword);

            const supabase = createClient();

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: demoEmail,
                password: demoPassword,
            });

            if (signInError) {
                if (signInError.message.includes('Invalid login credentials')) {
                    console.log('Demo account not found. Attempting auto-creation...');

                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email: demoEmail,
                        password: demoPassword,
                        options: {
                            data: {
                                full_name: demoEmail.includes('admin') ? '관리자(Demo)' : '안내데스크(Demo)',
                            }
                        }
                    });

                    if (signUpError) {
                        throw signUpError;
                    }

                    if (signUpData?.session) {
                        setSuccess('체험용 계정이 생성되고 로그인되었습니다.');
                        router.push('/');
                        router.refresh();
                        return;
                    }

                    if (signUpData?.user && !signUpData?.session) {
                        throw new Error('계정은 생성되었으나 이메일 인증이 필요합니다. Supabase Authentication 설정에서 "Confirm email" 옵션을 꺼주세요.');
                    }
                }

                if (signInError.message.includes('Email not confirmed')) {
                    throw new Error('계정이 생성되었으나 이메일 인증이 완료되지 않았습니다.\nSupabase 대시보드 > Authentication > Users에서\n해당 유저 우측 점 3개를 클릭해 "Confirm user"를 눌러주세요.');
                }

                throw signInError;
            }

            router.push('/');
            router.refresh();
        } catch (err) {
            console.error('Demo login error:', err);
            setError(err.message || '체험 모드 로그인 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden flex-col justify-between p-12">
                {/* Background Effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-1/4 -left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-1/4 -right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl"></div>
                </div>

                {/* Logo */}
                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                            <CheckCircle size={20} className="text-white" />
                        </div>
                        <span className="text-white font-bold text-xl">VoteCast</span>
                    </div>
                </div>

                {/* Main Content */}
                <div className="relative z-10 flex-1 flex flex-col justify-center">
                    <h1 className="text-4xl font-black text-white mb-4 leading-tight">
                        총회 관리<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">스마트 시스템</span>
                    </h1>
                    <p className="text-slate-400 text-lg mb-10">
                        효율적인 총회 운영을 위한<br />
                        실시간 체크인 & 투표 관리 플랫폼
                    </p>

                    {/* Features */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                                <Users size={18} className="text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-white font-medium">실시간 출석 체크인</p>
                                <p className="text-slate-500 text-sm">QR/검색으로 즉시 입장 확인</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <Settings size={18} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-white font-medium">안건별 투표 집계</p>
                                <p className="text-slate-500 text-sm">찬성/반대/기권 실시간 반영</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                <Monitor size={18} className="text-purple-400" />
                            </div>
                            <div>
                                <p className="text-white font-medium">프로젝터 송출</p>
                                <p className="text-slate-500 text-sm">현장 스크린에 결과 실시간 표시</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Notice */}
                <div className="relative z-10 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                        <Zap size={14} />
                        <span>실시간 연동</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">
                        관리자와 안내데스크가 실시간으로 연동됩니다.<br />
                        두 화면을 나란히 띄워 동시 체험해보세요!
                    </p>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 bg-slate-50 flex items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 md:p-10">
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl mb-4 shadow-lg">
                            <CheckCircle size={28} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">VoteCast</h1>
                        <p className="text-sm text-slate-500">총회 관리 시스템</p>
                    </div>

                    {/* Login Header */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900">로그인</h2>
                        <p className="text-slate-500 text-sm mt-1">시스템 접속을 위해 인증해주세요</p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex mb-6 bg-slate-50 rounded-xl p-1 border border-slate-100">
                        <button
                            onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${mode === 'login'
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-100'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            로그인
                        </button>
                        <button
                            onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${mode === 'signup'
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-100'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            회원가입
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 text-sm">
                            {success}
                        </div>
                    )}

                    {/* Email/Password Form */}
                    <form onSubmit={handleEmailAuth} className="space-y-4">
                        {/* Email Input */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">이메일</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">비밀번호</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password (Signup only) */}
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">비밀번호 확인</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>{mode === 'login' ? '로그인' : '가입하기'}</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="my-6 flex items-center gap-4">
                        <div className="flex-1 h-px bg-slate-200"></div>
                        <span className="text-xs text-slate-400">또는</span>
                        <div className="flex-1 h-px bg-slate-200"></div>
                    </div>

                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={isGoogleLoading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 px-6 rounded-xl border border-slate-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGoogleLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        )}
                        <span>Google로 계속하기</span>
                    </button>

                    {/* Demo Section Card */}
                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="bg-gradient-to-r from-slate-50 to-emerald-50/50 rounded-xl p-4 border border-slate-100">
                            <p className="text-center text-xs text-slate-600 font-medium mb-3">
                                🎯 심사위원 / 체험용 간편 접속
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleDemoLogin('admin@demo.com', 'demo1234')}
                                    disabled={isLoading || isGoogleLoading}
                                    className="flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-slate-700 py-2.5 rounded-lg border border-slate-200 hover:border-blue-300 transition-all text-sm font-medium disabled:opacity-50 shadow-sm"
                                >
                                    <Settings size={14} className="text-blue-500" />
                                    <span>관리자</span>
                                </button>
                                <button
                                    onClick={() => handleDemoLogin('desk@demo.com', 'demo1234')}
                                    disabled={isLoading || isGoogleLoading}
                                    className="flex items-center justify-center gap-2 bg-white hover:bg-emerald-50 text-slate-700 py-2.5 rounded-lg border border-slate-200 hover:border-emerald-300 transition-all text-sm font-medium disabled:opacity-50 shadow-sm"
                                >
                                    <Users size={14} className="text-emerald-500" />
                                    <span>안내데스크</span>
                                </button>
                            </div>
                            <p className="text-center text-[10px] text-slate-400 mt-2">
                                💡 안내데스크는 스마트폰/태블릿에서 테스트 권장
                            </p>
                        </div>
                    </div>

                    {/* Footer - Moved inside card for better encapsulation */}
                    <p className="text-center text-xs text-slate-300 mt-6 font-light">
                        VoteCast v1.0 © 2026
                    </p>
                </div>
            </div>
        </div>
    );
}
