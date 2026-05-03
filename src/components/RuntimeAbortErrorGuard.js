'use client';

const isExpectedAbortError = (value) => {
    if (!value) return false;

    const name = typeof value === 'object' ? value.name : '';
    const code = typeof value === 'object' ? value.code : '';
    const message = typeof value === 'object'
        ? value.message
        : String(value);

    return name === 'AbortError'
        || code === 'ABORT_ERR'
        || String(message || '').toLowerCase().includes('signal is aborted');
};

const hasExpectedAbortError = (values = []) => values.some(isExpectedAbortError);

const installAbortErrorGuard = () => {
    if (typeof window === 'undefined') return;
    if (window.__votecastAbortErrorGuardInstalled) return;

    window.__votecastAbortErrorGuardInstalled = true;

    const originalError = console.error.bind(console);
    const originalWarn = console.warn.bind(console);

    console.error = (...args) => {
        if (hasExpectedAbortError(args)) return;
        originalError(...args);
    };

    console.warn = (...args) => {
        if (hasExpectedAbortError(args)) return;
        originalWarn(...args);
    };

    window.addEventListener('unhandledrejection', (event) => {
        if (isExpectedAbortError(event.reason)) {
            event.preventDefault();
        }
    });

    window.addEventListener('error', (event) => {
        if (isExpectedAbortError(event.error) || isExpectedAbortError(event.message)) {
            event.preventDefault();
        }
    });
};

installAbortErrorGuard();

export default function RuntimeAbortErrorGuard() {
    return null;
}
