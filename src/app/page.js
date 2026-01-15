'use client';

import React from 'react';
import Link from 'next/link';
import { Users, Monitor, Settings, MapPin } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mb-4 text-white shadow-xl">
          <MapPin size={32} />
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-2">RHA VoteCast</h1>
        <p className="text-slate-500 text-lg">지역주택조합 총회 운영 시스템</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 w-full max-w-5xl">
        {/* Entrance Staff */}
        <Card className="p-8 hover:shadow-lg transition-shadow border-t-4 border-t-emerald-500">
          <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-6">
            <Users size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">입구 안내 요원</h2>
          <p className="text-slate-500 mb-6 text-sm h-10">
            조합원 입장을 검색하고 실시간으로 체크인합니다.<br />태블릿 권장.
          </p>
          <Link href="/checkin">
            <Button variant="success" fullWidth>입장 관리 시작</Button>
          </Link>
        </Card>

        {/* Admin */}
        <Card className="p-8 hover:shadow-lg transition-shadow border-t-4 border-t-slate-800">
          <div className="h-12 w-12 bg-slate-100 text-slate-800 rounded-lg flex items-center justify-center mb-6">
            <Settings size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">총회 관리자</h2>
          <p className="text-slate-500 mb-6 text-sm h-10">
            안건을 관리하고 투표 결과를 집계/입력합니다.<br />노트북 권장.
          </p>
          <Link href="/admin">
            <Button variant="primary" fullWidth>관리자 패널 접속</Button>
          </Link>
        </Card>

        {/* Projector */}
        <Card className="p-8 hover:shadow-lg transition-shadow border-t-4 border-t-blue-500">
          <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-6">
            <Monitor size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">스크린 송출</h2>
          <p className="text-slate-500 mb-6 text-sm h-10">
            대형 스크린에 보여줄 화면입니다.<br />관리자 제어에 따라 자동 변경됩니다.
          </p>
          <Link href="/projector">
            <Button variant="secondary" fullWidth>송출 화면 열기</Button>
          </Link>
        </Card>
      </div>

      <div className="mt-12 text-center text-xs text-slate-400">
        Demo Version | LocalStorage Sync Mode
      </div>
    </div>
  );
}
