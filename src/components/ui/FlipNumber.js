import React, { useEffect, useState, useRef } from 'react';

const FlipDigit = ({ digit, playSound, colorTheme = "slate" }) => {
    // 1. Prepare State for animation logic
    const [currentDigit, setCurrentDigit] = useState(digit);
    const [previousDigit, setPreviousDigit] = useState(digit);

    // Theme logic
    const themes = {
        slate: { bg: 'bg-slate-900', top: 'bg-slate-800', border: 'border-slate-950/50', text: 'text-slate-100', split: 'bg-slate-950' },
        emerald: { bg: 'bg-emerald-950', top: 'bg-emerald-800', border: 'border-emerald-950/50', text: 'text-emerald-50', split: 'bg-emerald-900' },
        orange: { bg: 'bg-orange-950', top: 'bg-orange-800', border: 'border-orange-950/50', text: 'text-orange-50', split: 'bg-orange-900' }
    };
    const t = themes[colorTheme] || themes.slate;

    // 2. Logic: If digit prop changes, update state immediately.
    // The previous digit becomes what was just current, and current becomes the new prop.
    if (digit !== currentDigit) {
        setPreviousDigit(currentDigit);
        setCurrentDigit(digit);
        if (playSound) playSound();
    }

    return (
        <div className={`relative w-8 h-12 md:w-11 md:h-16 ${t.bg} rounded-lg overflow-hidden shrink-0 shadow-lg perspective-1000 transition-colors duration-300`}>
            {/* --- Base Layer (Static) --- */}
            {/* Shows the NEW number normally. This acts as the "background" that gets revealed. */}
            <div className="absolute inset-0 z-0">
                <div className={`absolute top-0 left-0 right-0 h-1/2 overflow-hidden ${t.top} border-b ${t.border} rounded-t-lg transition-colors duration-300`}>
                    <span className={`absolute top-0 left-0 right-0 h-full flex items-center justify-center text-3xl md:text-5xl font-black ${t.text} translate-y-1/2 transition-colors duration-300`}>
                        {currentDigit}
                    </span>
                </div>
                <div className={`absolute bottom-0 left-0 right-0 h-1/2 overflow-hidden ${t.top} rounded-b-lg transition-colors duration-300`}>
                    <span className={`absolute bottom-0 left-0 right-0 h-full flex items-center justify-center text-3xl md:text-5xl font-black ${t.text} -translate-y-1/2 transition-colors duration-300`}>
                        {currentDigit}
                    </span>
                </div>
            </div>

            {/* --- Animation Layer (Dynamic) --- */}
            {/* Using key={currentDigit} forces React to destroy and recreate this div when the number changes.
                This ensures the CSS animation classes run from 0% every single time. */}
            <div key={currentDigit} className="absolute inset-0 z-10">
                {/* Top Flap: Shows OLD number. Flips down (0deg -> -90deg) to hide itself. */}
                <div
                    className={`absolute top-0 left-0 right-0 h-1/2 overflow-hidden ${t.top} border-b ${t.border} rounded-t-lg origin-bottom animate-flip-top backface-hidden`}
                    style={{ zIndex: 20 }}
                >
                    <span className={`absolute top-0 left-0 right-0 h-full flex items-center justify-center text-3xl md:text-5xl font-black ${t.text} translate-y-1/2`}>
                        {previousDigit}
                    </span>
                    <div className="absolute inset-0 bg-black/0 animate-[shading-top_0.6s_ease-in_forwards]"></div>
                </div>

                {/* Bottom Flap: Shows NEW number. Flips down (90deg -> 0deg) to reveal itself. */}
                <div
                    className={`absolute bottom-0 left-0 right-0 h-1/2 overflow-hidden ${t.top} rounded-b-lg origin-top animate-flip-bottom backface-hidden`}
                    style={{ zIndex: 20 }}
                >
                    <span className={`absolute bottom-0 left-0 right-0 h-full flex items-center justify-center text-3xl md:text-5xl font-black ${t.text} -translate-y-1/2`}>
                        {currentDigit}
                    </span>
                    <div className="absolute inset-0 bg-black/0 animate-[shading-bottom_0.6s_ease-out_forwards]"></div>
                </div>
            </div>

            {/* Split Line */}
            <div className={`absolute top-1/2 left-0 right-0 h-px ${t.split} z-30 shadow-sm opacity-50`}></div>
        </div>
    );
};

// Global for strict sound throttling
let globalLastPlayedTime = 0;

export default function FlipNumber({ value, colorTheme = "slate" }) {
    const digits = value.toString().split('');
    const audioContextRef = React.useRef(null);
    const audioBufferRef = React.useRef(null);
    const prevValueRef = React.useRef(value); // To track value changes

    // Initialize Web Audio API and load buffer
    React.useEffect(() => {
        const initAudio = async () => {
            try {
                // Create Context
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioContext();
                audioContextRef.current = ctx;

                // Resume context on user interaction (fixes "first play" delay)
                const unlockAudio = () => {
                    if (ctx.state === 'suspended') {
                        ctx.resume().then(() => console.log("AudioContext Resumed"));
                    }
                    document.removeEventListener('click', unlockAudio);
                    document.removeEventListener('touchstart', unlockAudio);
                };
                document.addEventListener('click', unlockAudio);
                document.addEventListener('touchstart', unlockAudio);

                // Fetch and decode audio data
                const response = await fetch('/sounds/flip.mp3');
                const arrayBuffer = await response.arrayBuffer();
                const decodedAudio = await ctx.decodeAudioData(arrayBuffer);
                audioBufferRef.current = decodedAudio;
            } catch (e) {
                console.error("Web Audio Init failed:", e);
            }
        };

        initAudio();

        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(e => console.error("Error closing AudioContext", e));
            }
        };
    }, []);

    // Zero-latency playback with throttling
    const playSound = React.useCallback(() => {
        try {
            const now = Date.now();
            // Throttle: Prevent double sounds within 500ms
            if (now - globalLastPlayedTime < 500) return;

            const ctx = audioContextRef.current;
            const buffer = audioBufferRef.current;

            if (ctx && buffer) {
                if (ctx.state === 'suspended') ctx.resume();

                const source = ctx.createBufferSource();
                source.buffer = buffer;

                const gainNode = ctx.createGain();
                gainNode.gain.value = 0.5;

                source.connect(gainNode);
                gainNode.connect(ctx.destination);

                // Skip first 10 frames (approx 0.33s at 30fps)
                source.start(0, 0.33);

                // Play for 1.0 second duration
                source.stop(ctx.currentTime + 1.0);

                globalLastPlayedTime = now;
            }
        } catch (e) {
            console.error("Audio playback error:", e);
        }
    }, []);

    // Trigger sound on value change (Parent Level)
    React.useEffect(() => {
        if (value !== prevValueRef.current) {
            playSound();
            prevValueRef.current = value;
        }
    }, [value, playSound]);

    return (
        <div className="flex gap-1 group">
            {digits.map((d, i) => (
                <FlipDigit key={`${i}-${digits.length}`} digit={d} colorTheme={colorTheme} />
            ))}
        </div>
    );
}
