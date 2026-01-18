
import React, { useEffect, useState, useRef } from 'react';

const FlipDigit = ({ digit, playSound }) => {
    const [currentDigit, setCurrentDigit] = useState(digit);
    const [previousDigit, setPreviousDigit] = useState(digit);
    const [isFlipping, setIsFlipping] = useState(false);

    useEffect(() => {
        if (digit !== currentDigit) {
            setPreviousDigit(currentDigit);
            setCurrentDigit(digit);
            setIsFlipping(true);
            if (playSound) playSound();

            const timer = setTimeout(() => {
                setIsFlipping(false);
                setPreviousDigit(digit);
            }, 600); // Animation duration

            return () => clearTimeout(timer);
        }
    }, [digit, currentDigit, playSound]);

    return (
        <div className="relative w-10 h-14 bg-slate-900 rounded-lg overflow-hidden shrink-0 shadow-lg perspective-1000">
            {/* Top Half (Base - Current/Next) - actually this sits behind the flipper */}
            {/* When flipping, we want the NEW digit to be visible behind the top flipper immediately? 
                No, base should be Next Digit (Top) and Previous Digit (Bottom) ?
                Standard Split Flap: 
                - Static Top: Next Digit (Waiting to be revealed?) No, Current Digit.
                - Static Bottom: Next Digit.
                - Moving Top: Current Digit (Folds down).
                - Moving Bottom: Next Digit (Folds down).
                
                Let's simplify:
                - Base Top: Next Digit (CurrentDigit state in my code). 
                - Base Bottom: Previous Digit (PreviousDigit state).
                
                Wait, if I change 8 -> 9.
                Static Top: Show 9 (The new number).
                Static Bottom: Show 8 (The old number).
                Flipper Top: Show 8 (Old). Animation: 0 -> -90.
                Flipper Bottom: Show 9 (New). Animation: 90 -> 0.
            */}

            {/* Top Half (Base - Next Digit) */}
            <div className="absolute top-0 left-0 right-0 h-1/2 overflow-hidden bg-slate-800 border-b border-slate-950/50 rounded-t-lg z-0">
                <span className="absolute top-0 left-0 right-0 h-full flex items-center justify-center text-5xl font-black text-slate-100 translate-y-1/2">
                    {currentDigit}
                </span>
            </div>

            {/* Bottom Half (Base - Previous Digit) */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 overflow-hidden bg-slate-800 rounded-b-lg z-0">
                <span className="absolute bottom-0 left-0 right-0 h-full flex items-center justify-center text-5xl font-black text-slate-100 -translate-y-1/2">
                    {previousDigit}
                </span>
            </div>

            {/* Top Flip (Previous Digit - Folds Down) */}
            <div
                className="absolute top-0 left-0 right-0 h-1/2 overflow-hidden bg-slate-800 border-b border-slate-950/50 rounded-t-lg z-10 origin-bottom backface-hidden transition-transform duration-300 ease-in"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipping ? 'rotateX(-90deg)' : 'rotateX(0deg)'
                }}
            >
                <span className="absolute top-0 left-0 right-0 h-full flex items-center justify-center text-5xl font-black text-slate-100 translate-y-1/2">
                    {previousDigit}
                </span>
                {/* Shadow Overlay: Darkens as it flips down */}
                <div className={`absolute inset-0 bg-black transition-opacity duration-300 ease-in z-20 ${isFlipping ? 'opacity-60' : 'opacity-0'}`}></div>
            </div>

            {/* Bottom Flip (Next Digit - Folds Down) */}
            <div
                className="absolute bottom-0 left-0 right-0 h-1/2 overflow-hidden bg-slate-800 rounded-b-lg z-10 origin-top backface-hidden transition-transform duration-300 ease-out"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipping ? 'rotateX(0deg)' : 'rotateX(90deg)'
                }}
            >
                <span className="absolute bottom-0 left-0 right-0 h-full flex items-center justify-center text-5xl font-black text-slate-100 -translate-y-1/2">
                    {currentDigit}
                </span>
                {/* Shadow Overlay: Lightens as it flips flat */}
                <div className={`absolute inset-0 bg-black transition-opacity duration-300 ease-out z-20 ${isFlipping ? 'opacity-0' : 'opacity-60'}`}></div>
            </div>

            {/* Split Line Glow/Shadow */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-950 z-20 shadow-sm opacity-50"></div>
        </div>
    );
};

// Global for strict sound throttling
let globalLastPlayedTime = 0;

export default function FlipNumber({ value }) {
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
        <div className="flex gap-1">
            {digits.map((d, i) => (
                <FlipDigit key={`${i}-${digits.length}`} digit={d} />
            ))}
        </div>
    );
}
