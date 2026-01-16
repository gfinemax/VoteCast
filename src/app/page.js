'use client';

import React from 'react';
import Link from 'next/link';
import { Users, Monitor, Settings, MapPin, ClipboardList, ExternalLink } from 'lucide-react';
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

      <div className="grid md:grid-cols-3 gap-6 w-full max-w-6xl mb-12">
        {/* Entrance Staff */}
        <Card className="p-8 hover:shadow-lg transition-shadow border-t-4 border-t-emerald-500 flex flex-col h-full bg-white">
          <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-6">
            <Users size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">입구 안내 요원</h2>
          <p className="text-slate-500 mb-8 text-sm flex-1 leading-relaxed">
            조합원 입장을 검색하고 실시간으로 체크인합니다.<br />태블릿 사용을 권장합니다.
          </p>
          <Link href="/checkin" className="w-full mt-auto">
            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-md">입장 관리 시작</Button>
          </Link>
        </Card>

        {/* Election Commission */}
        <Card className="p-8 hover:shadow-lg transition-shadow border-t-4 border-t-orange-500 flex flex-col h-full bg-white">
          <div className="h-12 w-12 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center mb-6">
            <ClipboardList size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">선거관리위원회</h2>
          <p className="text-slate-500 mb-8 text-sm flex-1 leading-relaxed">
            투표 결과를 집계하고 입력합니다.<br />결과(Result) 화면을 송출할 수 있습니다.
          </p>
          <Link href="/commission" className="w-full mt-auto">
            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-md">선관위 패널 접속</Button>
          </Link>
        </Card>

        {/* Admin */}
        <Card className="p-8 hover:shadow-lg transition-shadow border-t-4 border-t-sky-600 flex flex-col h-full bg-white">
          <div className="h-12 w-12 bg-sky-100 text-sky-700 rounded-lg flex items-center justify-center mb-6">
            <Settings size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">총회 관리자</h2>
          <p className="text-slate-500 mb-8 text-sm flex-1 leading-relaxed">
            안건 설명(PPT) 및 전체 시스템을 총괄합니다.<br />모든 권한을 가집니다.
          </p>
          <Link href="/admin" className="w-full mt-auto">
            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-md">관리자 패널 접속</Button>
          </Link>
        </Card>
      </div>

      {/* Footer Utility Link */}
      <div className="text-center">
        <Link href="/projector" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-500 text-sm font-medium transition-colors px-4 py-2 rounded-full hover:bg-blue-50">
          <Monitor size={14} />
          <span>스크린 송출 뷰 열기 (Projector)</span>
          <ExternalLink size={12} />
        </Link>
      </div>

      <div className="mt-8 text-center text-xs text-slate-300">
        Demo Version | LocalStorage Sync Mode
      </div>
    </div>
  );
}
