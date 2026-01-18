'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, Monitor, Settings, MapPin, ClipboardList, ExternalLink, LogOut, User } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    checkUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-2xl"></div>
        <div className="absolute bottom-1/3 left-1/4 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-2xl"></div>
      </div>

      {/* Header / Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <MapPin size={16} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg hidden sm:inline">VoteCast</span>
          </div>

          {/* Auth Status */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-24 h-8 bg-white/5 rounded-lg animate-pulse"></div>
            ) : user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5">
                  <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <User size={12} className="text-emerald-400" />
                  </div>
                  <span className="text-xs text-slate-300 font-medium max-w-[120px] truncate hidden sm:inline">
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="로그아웃"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
              >
                <User size={14} />
                <span>로그인</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl">
        {/* Logo & Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-3xl mb-6 shadow-2xl shadow-emerald-500/20">
            <MapPin size={36} className="text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">VoteCast</h1>
          <p className="text-slate-400 text-lg">지역주택조합 총회 운영 시스템</p>
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Entrance Staff */}
          <div className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all duration-300 flex flex-col relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400"></div>

            <div className="h-14 w-14 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Users size={28} />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">입구 안내 요원</h2>
            <p className="text-slate-400 mb-8 text-sm flex-1 leading-relaxed">
              조합원 입장을 검색하고 실시간으로 체크인합니다.<br />태블릿 사용을 권장합니다.
            </p>
            <Link href="/checkin" className="w-full mt-auto">
              <button className="w-full py-3 bg-white/10 hover:bg-emerald-500 text-white font-semibold rounded-xl border border-white/10 hover:border-emerald-500 transition-all duration-300 shadow-lg hover:shadow-emerald-500/20">
                입장 관리 시작
              </button>
            </Link>
          </div>

          {/* Election Commission */}
          <div className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all duration-300 flex flex-col relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-orange-400"></div>

            <div className="h-14 w-14 bg-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ClipboardList size={28} />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">선거관리위원회</h2>
            <p className="text-slate-400 mb-8 text-sm flex-1 leading-relaxed">
              투표 결과를 집계하고 입력합니다.<br />결과(Result) 화면을 송출할 수 있습니다.
            </p>
            <Link href="/commission" className="w-full mt-auto">
              <button className="w-full py-3 bg-white/10 hover:bg-orange-500 text-white font-semibold rounded-xl border border-white/10 hover:border-orange-500 transition-all duration-300 shadow-lg hover:shadow-orange-500/20">
                선관위 패널 접속
              </button>
            </Link>
          </div>

          {/* Admin */}
          <div className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all duration-300 flex flex-col relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400"></div>

            <div className="h-14 w-14 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Settings size={28} />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">총회 관리자</h2>
            <p className="text-slate-400 mb-8 text-sm flex-1 leading-relaxed">
              안건 설명(PPT) 및 전체 시스템을 총괄합니다.<br />모든 권한을 가집니다.
            </p>
            <Link href="/admin" className="w-full mt-auto">
              <button className="w-full py-3 bg-white/10 hover:bg-blue-500 text-white font-semibold rounded-xl border border-white/10 hover:border-blue-500 transition-all duration-300 shadow-lg hover:shadow-blue-500/20">
                관리자 패널 접속
              </button>
            </Link>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center space-y-4">
          <Link
            href="/projector"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium transition-colors px-4 py-2 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10"
          >
            <Monitor size={14} />
            <span>스크린 송출 뷰 열기 (Projector)</span>
            <ExternalLink size={12} />
          </Link>
        </div>

        <div className="mt-8 text-center text-xs text-slate-600">
          VoteCast v1.0 | Real-time Sync Mode
        </div>
      </div>
    </div>
  );
}
