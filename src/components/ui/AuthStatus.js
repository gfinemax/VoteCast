'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { LogOut, User, ChevronDown } from 'lucide-react';

export default function AuthStatus() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const checkUser = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);
            } catch (e) {
                console.error('Auth check error:', e);
            } finally {
                setLoading(false);
            }
        };
        checkUser();
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        setUser(null);
        setIsOpen(false);
        router.push('/login');
        router.refresh();
    };

    if (loading) {
        return (
            <div className="w-8 h-8 bg-slate-100 rounded-full animate-pulse"></div>
        );
    }

    if (user) {
        return (
            <div className="relative" ref={dropdownRef}>
                {/* Avatar Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-1 p-1.5 rounded-full transition-colors ${isOpen ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                >
                    <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center">
                        <User size={14} className="text-emerald-600" />
                    </div>
                    <ChevronDown size={12} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* User Info */}
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <User size={18} className="text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-400 mb-0.5">로그인됨</p>
                                    <p className="text-sm font-medium text-slate-700 truncate">
                                        {user.email}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-2">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <LogOut size={16} />
                                <span>로그아웃</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <Link
            href="/login"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
            <User size={14} />
            <span>로그인</span>
        </Link>
    );
}
