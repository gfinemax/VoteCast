'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Search, UserCheck, Check, Clock } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function CheckInPage() {
    const { state, actions } = useStore();
    const [searchTerm, setSearchTerm] = useState("");

    const filteredMembers = useMemo(() => {
        if (!searchTerm) return state.members;
        return state.members.filter(m =>
            m.unit.includes(searchTerm) || m.name.includes(searchTerm)
        );
    }, [state.members, searchTerm]);

    const stats = useMemo(() => {
        return {
            total: state.members.length,
            checkedIn: state.members.filter(m => m.isCheckedIn).length
        };
    }, [state.members]);

    return (
        <div className="min-h-screen bg-slate-100 p-4 font-sans">
            <div className="max-w-md mx-auto space-y-4">

                {/* Header with Stats */}
                <header className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="font-bold text-slate-900 flex items-center gap-2">
                            <UserCheck className="text-emerald-500" />
                            입구 체크인
                        </h1>
                        <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">
                            STAFF MODE
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 bg-slate-50 p-3 rounded-lg text-center">
                            <div className="text-xs text-slate-400">총 조합원</div>
                            <div className="font-bold text-lg">{stats.total}</div>
                        </div>
                        <div className="flex-1 bg-emerald-50 p-3 rounded-lg text-center border border-emerald-100">
                            <div className="text-xs text-emerald-600">입장 완료</div>
                            <div className="font-bold text-lg text-emerald-700">{stats.checkedIn}</div>
                        </div>
                    </div>
                </header>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="동/호수(101-102) 또는 이름 검색"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* List */}
                <div className="space-y-2 pb-20">
                    {filteredMembers.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            검색 결과가 없습니다.
                        </div>
                    ) : (
                        filteredMembers.map(member => (
                            <Card key={member.id} className={`p-4 transition-all ${member.isCheckedIn ? 'bg-slate-50 opacity-70' : 'bg-white'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono font-bold text-lg text-slate-800">{member.unit}</span>
                                            {member.isCheckedIn && <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock size={10} /> 입장완료</span>}
                                        </div>
                                        <div className="text-slate-500">{member.name} 조합원</div>
                                    </div>

                                    {member.isCheckedIn ? (
                                        <Button variant="secondary" disabled className="text-xs px-3">
                                            <Check size={16} /> 확인완료
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="success"
                                            onClick={() => actions.checkInMember(member.id)}
                                            className="px-6 shadow-sm"
                                        >
                                            입장 확인
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
