
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
            </div>

            {/* Split Line Glow/Shadow */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-950 z-20 shadow-sm opacity-50"></div>
        </div>
    );
};

export default function FlipNumber({ value }) {
    const digits = value.toString().split('');
    const audioRef = useRef(null);

    // Initialize audio only once on client
    useEffect(() => {
        audioRef.current = new Audio('/sounds/flip.mp3');
    }, []);

    const playSound = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.log('Audio play failed', e));
        }
    };

    return (
        <div className="flex gap-1">
            {digits.map((d, i) => (
                <FlipDigit key={`${i}-${digits.length}`} digit={d} playSound={playSound} />
            ))}
        </div>
    );
}
