'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Play, Pause, Volume2, VolumeX, Upload, Music, ListMusic, X, Trash2, Maximize2, Minimize2, MoreVertical, Loader2, Plus, Disc } from 'lucide-react';

export default function BgmPlayer() {
    // UI State
    const [isOpen, setIsOpen] = useState(false); // Popup toggle
    const [view, setView] = useState('PLAYER'); // 'PLAYER' | 'LIST'

    // Audio State
    const audioRef = useRef(null);
    const [playlist, setPlaylist] = useState([]);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Data State
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Initial Load
    useEffect(() => {
        fetchPlaylist();
    }, []);

    const fetchPlaylist = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('bgm_tracks')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPlaylist(data || []);

            // Auto-select first track if none selected logic could go here
        } catch (error) {
            console.error('Error fetching playlist:', error);
            // Fallback for demo if table missing?
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
            const filePath = `tracks/${fileName}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('bgm-files')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('bgm-files')
                .getPublicUrl(filePath);

            // 3. Save to DB
            const { data: track, error: dbError } = await supabase
                .from('bgm_tracks')
                .insert([
                    { title: file.name.replace(/\.[^/.]+$/, ""), url: publicUrl, size: file.size }
                ])
                .select()
                .single();

            if (dbError) throw dbError;

            // 4. Update List
            setPlaylist([track, ...playlist]);

            // Auto-play if empty
            if (!currentTrack) {
                playTrack(track);
            }

        } catch (error) {
            console.error('Upload failed:', error);
            alert('업로드 실패: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (e, id, url) => {
        e.stopPropagation();
        if (!confirm('삭제하시겠습니까?')) return;

        try {
            // Logic to delete from storage could be added here parsing the URL
            // ...

            const { error } = await supabase.from('bgm_tracks').delete().eq('id', id);
            if (error) throw error;

            setPlaylist(playlist.filter(t => t.id !== id));
            if (currentTrack?.id === id) {
                setIsPlaying(false);
                setCurrentTrack(null);
                if (audioRef.current) audioRef.current.src = "";
            }
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const playTrack = (track) => {
        if (currentTrack?.id === track.id) {
            togglePlay();
            return;
        }

        setCurrentTrack(track);
        setIsPlaying(true);
        if (audioRef.current) {
            audioRef.current.src = track.url;
            audioRef.current.play().catch(e => console.error("Play error:", e));
        }
    };

    const togglePlay = () => {
        if (!audioRef.current || !currentTrack) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const playNext = () => {
        if (!currentTrack || playlist.length === 0) return;
        const idx = playlist.findIndex(t => t.id === currentTrack.id);
        const nextIdx = (idx + 1) % playlist.length;
        playTrack(playlist[nextIdx]);
    };

    const playPrev = () => {
        if (!currentTrack || playlist.length === 0) return;
        const idx = playlist.findIndex(t => t.id === currentTrack.id);
        const prevIdx = (idx - 1 + playlist.length) % playlist.length;
        playTrack(playlist[prevIdx]);
    };

    // Audio Events
    const onTimeUpdate = () => setCurrentTime(audioRef.current?.currentTime || 0);
    const onLoadedMetadata = () => setDuration(audioRef.current?.duration || 0);
    const onEnded = () => playNext(); // Auto-play next

    // Minimized View (Floating Button)
    if (!isOpen) {
        return (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between group cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setIsOpen(true)}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-emerald-500 scale-100 shadow-lg shadow-emerald-200' : 'bg-slate-100 scale-95'}`}>
                        {isPlaying ? (
                            <div className="flex gap-0.5 items-end justify-center h-4 pb-1">
                                <span className="w-1 bg-white animate-[bounce_1s_infinite] h-2"></span>
                                <span className="w-1 bg-white animate-[bounce_1.2s_infinite] h-4"></span>
                                <span className="w-1 bg-white animate-[bounce_0.8s_infinite] h-3"></span>
                            </div>
                        ) : (
                            <Music size={18} className="text-slate-400" />
                        )}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-700 truncate max-w-[140px]">
                            {currentTrack ? currentTrack.title : "BGM Player"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                            {isPlaying ? "재생 중..." : "터치하여 열기"}
                        </div>
                    </div>
                </div>
                {/* Visualizer / Maximize */}
            </div>
        );
    }

    // Expanded Popup (Refined UI)
    return (
        <div className="absolute bottom-4 left-4 right-4 w-auto bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50 flex flex-col transition-all duration-300 z-50 animate-in slide-in-from-bottom-5 fade-in">
            <audio
                ref={audioRef}
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={onLoadedMetadata}
                onEnded={onEnded}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 tracking-wider">
                    <ListMusic size={14} /> EVENT MUSIC
                </span>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                    <Minimize2 size={16} />
                </button>
            </div>

            {/* View Switching */}
            {view === 'PLAYER' ? (
                // PLAYER VIEW
                <div className="p-6 flex flex-col items-center">
                    {/* Album Art / Visual */}
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-slate-800 to-slate-700 mb-6 flex items-center justify-center shadow-inner relative group">
                        <div className={`absolute inset-0 rounded-full border-2 border-slate-600/30 ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`}></div>
                        <Disc size={48} className={`text-slate-500 transition-all ${isPlaying ? 'text-emerald-500/80' : ''}`} />
                    </div>

                    {/* Meta */}
                    <div className="text-center w-full mb-6">
                        <h3 className="text-lg font-bold text-white truncate px-2">
                            {currentTrack ? currentTrack.title : "재생할 곡을 선택하세요"}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono mt-1">
                            {isPlaying ? "Now Playing" : "Ready"}
                        </p>
                    </div>

                    {/* Progress */}
                    <div className="w-full space-y-2 mb-6">
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>{fmt(currentTime)}</span>
                            <span>{fmt(duration)}</span>
                        </div>
                        <div
                            className="relative w-full h-1.5 bg-slate-700 rounded-full cursor-pointer group"
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const pct = (e.clientX - rect.left) / rect.width;
                                if (audioRef.current) audioRef.current.currentTime = pct * duration;
                            }}
                        >
                            <div
                                className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full group-hover:bg-emerald-400 transition-all"
                                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                            >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-6 w-full mb-4">
                        <button onClick={playPrev} className="text-slate-400 hover:text-white transition-colors">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                        </button>

                        <button
                            onClick={togglePlay}
                            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all ${isPlaying
                                ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                                : 'bg-white text-slate-900 shadow-white/10'
                                }`}
                        >
                            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                        </button>

                        <button onClick={playNext} className="text-slate-400 hover:text-white transition-colors">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                        </button>
                    </div>

                    {/* Footer Actions */}
                    <div className="w-full flex justify-between items-center mt-2 px-2">
                        <div className="flex items-center gap-2 group">
                            {volume === 0 ? <VolumeX size={14} className="text-slate-500" /> : <Volume2 size={14} className="text-slate-400 group-hover:text-emerald-400 transition-colors" />}
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={volume}
                                onChange={(e) => {
                                    setVolume(parseFloat(e.target.value));
                                    if (audioRef.current) audioRef.current.volume = parseFloat(e.target.value);
                                }}
                                className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-400 hover:[&::-webkit-slider-thumb]:bg-white"
                            />
                        </div>
                        <button
                            onClick={() => setView('LIST')}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-full transition-colors"
                        >
                            <ListMusic size={12} /> LIST
                        </button>
                    </div>
                </div>
            ) : (
                // LIST VIEW
                <div className="flex-1 flex flex-col min-h-[360px]">
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-hide space-y-1">
                        {isLoading && <div className="text-center py-4 text-xs text-slate-500">로딩 중...</div>}

                        {!isLoading && playlist.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                                <Music size={24} className="mb-2 opacity-50" />
                                <span className="text-xs">등록된 음악이 없습니다.</span>
                            </div>
                        )}

                        {playlist.map((track, i) => (
                            <div
                                key={track.id || i}
                                onClick={() => playTrack(track)}
                                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${currentTrack?.id === track.id
                                    ? 'bg-white/10 border border-white/5'
                                    : 'hover:bg-white/5 border border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${currentTrack?.id === track.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                        {currentTrack?.id === track.id && isPlaying ? (
                                            <div className="flex gap-0.5 items-end h-3 pb-0.5">
                                                <span className="w-0.5 bg-emerald-400 animate-[bounce_1s_infinite] h-2"></span>
                                                <span className="w-0.5 bg-emerald-400 animate-[bounce_1.4s_infinite] h-3"></span>
                                                <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite] h-2"></span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-mono">{i + 1}</span>
                                        )}
                                    </div>
                                    <span className={`text-xs font-medium truncate ${currentTrack?.id === track.id ? 'text-emerald-400' : 'text-slate-300 group-hover:text-white'}`}>
                                        {track.title}
                                    </span>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(e, track.id, track.url)}
                                    className="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="p-3 border-t border-slate-700/50 bg-slate-800/50 space-y-2">
                        <label className={`flex items-center justify-center w-full py-2 border border-dashed border-slate-600 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors gap-2 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                            {isUploading ? (
                                <Loader2 size={14} className="animate-spin text-emerald-500" />
                            ) : (
                                <Plus size={14} className="text-emerald-500" />
                            )}
                            <span className="text-xs font-bold text-slate-300">
                                {isUploading ? '업로드 중...' : '새로운 음악 추가'}
                            </span>
                        </label>
                        <button
                            onClick={() => setView('PLAYER')}
                            className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                        >
                            플레이어로 돌아가기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function fmt(s) {
    if (!s) return "0:00";
    const m = Math.floor(s / 60);
    const sc = Math.floor(s % 60);
    return `${m}:${sc < 10 ? '0' : ''}${sc}`;
}
