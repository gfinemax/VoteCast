import React from 'react';

const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, fullWidth = false }) => {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300",
        secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100",
        danger: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
        success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5",
        ghost: "bg-transparent text-slate-500 hover:bg-slate-100",
    };

    return (
        <button
            onClick={onClick}
            className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
            disabled={disabled}
        >
            {children}
        </button>
    );
};

export default Button;
