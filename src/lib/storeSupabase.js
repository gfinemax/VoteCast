import { supabase } from '@/lib/supabase';

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_QUERY_TIMEOUT_MS = 12000;

const withTimeout = (promise, timeoutMs = DEFAULT_QUERY_TIMEOUT_MS) => {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const error = new Error(`Supabase request timed out after ${timeoutMs}ms`);
            error.code = 'QUERY_TIMEOUT';
            reject(error);
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
};

export const serializeSupabaseError = (error) => {
    if (!error) return null;

    const serialized = {
        name: error.name,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        status: error.status,
        statusCode: error.statusCode
    };

    const hasKnownField = Object.values(serialized).some((value) => value !== undefined && value !== null && value !== '');
    if (hasKnownField) return serialized;

    try {
        return JSON.parse(JSON.stringify(error));
    } catch {
        return String(error);
    }
};

export const isAbortError = (error) => (
    error?.name === 'AbortError'
    || error?.code === 'ABORT_ERR'
    || String(error?.message || '').toLowerCase().includes('signal is aborted')
);

export const updateSystemSettingsWithRetry = async (updates, label, { retries = 2 } = {}) => {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        let error = null;

        try {
            ({ error } = await supabase
                .from('system_settings')
                .update(updates)
                .eq('id', 1));
        } catch (caughtError) {
            if (isAbortError(caughtError)) return false;
            error = caughtError;
        }

        if (!error) return true;

        lastError = error;
        if (attempt < retries) {
            await wait(250 * (attempt + 1));
        }
    }

    console.warn(`${label}:`, serializeSupabaseError(lastError));
    return false;
};

export const fetchSystemSettingsWithRetry = async (label, { retries = 2 } = {}) => {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        let data = null;
        let error = null;

        try {
            ({ data, error } = await supabase
                .from('system_settings')
                .select('*')
                .eq('id', 1)
                .single());
        } catch (caughtError) {
            if (isAbortError(caughtError)) return null;
            error = caughtError;
        }

        if (!error) return data;

        lastError = error;
        if (attempt < retries) {
            await wait(250 * (attempt + 1));
        }
    }

    console.warn(`${label}:`, serializeSupabaseError(lastError));
    return null;
};

export const queryWithRetry = async (queryFactory, label, { retries = 2, suppressCodes = [] } = {}) => {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        let data = null;
        let error = null;

        try {
            ({ data, error } = await withTimeout(queryFactory()));
        } catch (caughtError) {
            if (isAbortError(caughtError)) return null;
            error = caughtError;
        }

        if (!error) return data;

        if (suppressCodes.includes(error.code)) {
            console.warn(`${label}:`, serializeSupabaseError(error));
            return [];
        }

        lastError = error;
        if (attempt < retries) {
            await wait(250 * (attempt + 1));
        }
    }

    console.warn(`${label}:`, serializeSupabaseError(lastError));
    return null;
};
