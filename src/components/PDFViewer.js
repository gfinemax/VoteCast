'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

let pdfjsPromise = null;
let pdfSourceCacheDbPromise = null;
const pdfDocumentCache = new Map();
const renderedPageCache = new Map();
const pendingPdfSourceFetches = new Map();
const MAX_RENDERED_PAGE_CACHE = 48;
const PDF_SOURCE_CACHE_DB = 'votecast-pdf-source-cache';
const PDF_SOURCE_CACHE_STORE = 'pdfs';
const PDF_SOURCE_CACHE_MAX_BYTES = 512 * 1024 * 1024;
const PDF_SOURCE_CACHE_MAX_ENTRIES = 24;

function normalizePageNumber(pageNumber) {
    return Math.max(1, parseInt(pageNumber, 10) || 1);
}

function getPersistentPdfCacheKey(url) {
    if (!url) return '';

    try {
        const parsedUrl = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
        parsedUrl.search = '';
        parsedUrl.hash = '';
        return parsedUrl.toString();
    } catch {
        return String(url).split(/[?#]/)[0];
    }
}

function canUsePersistentPdfCache(url) {
    if (typeof window === 'undefined' || !window.indexedDB || !url) return false;
    return !String(url).startsWith('blob:') && !String(url).startsWith('data:');
}

function openPdfSourceCacheDb() {
    if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
    if (pdfSourceCacheDbPromise) return pdfSourceCacheDbPromise;

    pdfSourceCacheDbPromise = new Promise((resolve) => {
        const request = window.indexedDB.open(PDF_SOURCE_CACHE_DB, 1);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PDF_SOURCE_CACHE_STORE)) {
                const store = db.createObjectStore(PDF_SOURCE_CACHE_STORE, { keyPath: 'key' });
                store.createIndex('lastAccessedAt', 'lastAccessedAt');
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });

    return pdfSourceCacheDbPromise;
}

function readPdfSourceRecord(db, key) {
    return new Promise((resolve) => {
        const transaction = db.transaction(PDF_SOURCE_CACHE_STORE, 'readonly');
        const request = transaction.objectStore(PDF_SOURCE_CACHE_STORE).get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

function writePdfSourceRecord(db, record) {
    return new Promise((resolve) => {
        const transaction = db.transaction(PDF_SOURCE_CACHE_STORE, 'readwrite');
        const request = transaction.objectStore(PDF_SOURCE_CACHE_STORE).put(record);

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
    });
}

function trimPdfSourceCache(db, protectedKey) {
    return new Promise((resolve) => {
        const transaction = db.transaction(PDF_SOURCE_CACHE_STORE, 'readwrite');
        const store = transaction.objectStore(PDF_SOURCE_CACHE_STORE);
        const request = store.getAll();

        request.onsuccess = () => {
            const records = (request.result || [])
                .map((record) => ({
                    key: record.key,
                    size: record.size || record.blob?.size || 0,
                    lastAccessedAt: record.lastAccessedAt || 0
                }))
                .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
            let totalSize = records.reduce((sum, record) => sum + record.size, 0);
            let entryCount = records.length;

            records.forEach((record) => {
                if (record.key === protectedKey) return;
                if (totalSize <= PDF_SOURCE_CACHE_MAX_BYTES && entryCount <= PDF_SOURCE_CACHE_MAX_ENTRIES) return;

                store.delete(record.key);
                totalSize -= record.size;
                entryCount -= 1;
            });
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        request.onerror = () => resolve();
    });
}

async function getCachedPdfObjectUrl(url) {
    if (!canUsePersistentPdfCache(url)) {
        return { objectUrl: url, shouldRevoke: false };
    }

    const cacheKey = getPersistentPdfCacheKey(url);
    const db = await openPdfSourceCacheDb();
    if (!db) return { objectUrl: url, shouldRevoke: false };

    const cachedRecord = await readPdfSourceRecord(db, cacheKey);
    if (cachedRecord?.blob) {
        writePdfSourceRecord(db, {
            ...cachedRecord,
            lastAccessedAt: Date.now()
        });

        return {
            objectUrl: URL.createObjectURL(cachedRecord.blob),
            shouldRevoke: true
        };
    }

    let fetchPromise = pendingPdfSourceFetches.get(cacheKey);
    if (!fetchPromise) {
        fetchPromise = fetch(url, { cache: 'force-cache' })
            .then((response) => {
                if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`);
                return response.blob();
            })
            .then(async (blob) => {
                await writePdfSourceRecord(db, {
                    key: cacheKey,
                    sourceUrl: url,
                    blob,
                    size: blob.size,
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now()
                });
                await trimPdfSourceCache(db, cacheKey);
                return blob;
            })
            .finally(() => {
                pendingPdfSourceFetches.delete(cacheKey);
            });
        pendingPdfSourceFetches.set(cacheKey, fetchPromise);
    }

    const blob = await fetchPromise;
    return {
        objectUrl: URL.createObjectURL(blob),
        shouldRevoke: true
    };
}

function loadPdfjs() {
    if (!pdfjsPromise) {
        pdfjsPromise = import(/* webpackIgnore: true */ '/pdfjs/pdf.min.mjs').then((pdfjs) => {
            pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
            return pdfjs;
        });
    }

    return pdfjsPromise;
}

function getPdfDocument(url) {
    if (!url) return null;

    let documentPromise = pdfDocumentCache.get(url);
    if (!documentPromise) {
        documentPromise = loadPdfjs().then((pdfjs) => pdfjs.getDocument({
            url,
            disableAutoFetch: false,
            disableStream: false
        }).promise);
        pdfDocumentCache.set(url, documentPromise);
    }

    return documentPromise;
}

function getRenderBucket(width, height) {
    return `${Math.round(width / 80) * 80}x${Math.round(height / 80) * 80}`;
}

function getCacheKey(url, pageNumber, width, height) {
    return `${url}|${pageNumber}|${getRenderBucket(width, height)}`;
}

function trimRenderedPageCache() {
    while (renderedPageCache.size > MAX_RENDERED_PAGE_CACHE) {
        const oldestKey = renderedPageCache.keys().next().value;
        renderedPageCache.delete(oldestKey);
    }
}

function getFittedViewport(page, width, height) {
    const baseViewport = page.getViewport({ scale: 1 });
    const cssScale = Math.min(width / baseViewport.width, height / baseViewport.height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.max(0.1, cssScale * pixelRatio);

    return {
        viewport: page.getViewport({ scale }),
        pixelRatio
    };
}

async function renderPageToCache(url, pageNumber, width, height) {
    const pdfDocument = await getPdfDocument(url);
    const safePageNumber = Math.min(normalizePageNumber(pageNumber), pdfDocument.numPages);
    const cacheKey = getCacheKey(url, safePageNumber, width, height);
    const cached = renderedPageCache.get(cacheKey);

    if (cached) return cached;

    const page = await pdfDocument.getPage(safePageNumber);
    const { viewport, pixelRatio } = getFittedViewport(page, width, height);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({
        canvasContext: context,
        viewport
    }).promise;

    const renderedPage = {
        canvas,
        width: canvas.width,
        height: canvas.height,
        cssWidth: canvas.width / pixelRatio,
        cssHeight: canvas.height / pixelRatio
    };

    renderedPageCache.set(cacheKey, renderedPage);
    trimRenderedPageCache();

    return renderedPage;
}

function paintRenderedPage(targetCanvas, renderedPage) {
    const context = targetCanvas.getContext('2d', { alpha: false });

    targetCanvas.width = renderedPage.width;
    targetCanvas.height = renderedPage.height;
    targetCanvas.style.width = `${renderedPage.cssWidth}px`;
    targetCanvas.style.height = `${renderedPage.cssHeight}px`;
    context.drawImage(renderedPage.canvas, 0, 0);
}

export default function PDFViewer({ url, pageNumber, preloadPages = [], className }) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const renderTokenRef = useRef(0);
    const hasPaintedRef = useRef(false);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const targetPage = normalizePageNumber(pageNumber);
    const pdfSourceKey = useMemo(() => getPersistentPdfCacheKey(url), [url]);
    const sourceKey = url ? `${pdfSourceKey}|${targetPage}` : '';
    const [resolvedSourceState, setResolvedSourceState] = useState({
        key: '',
        url: null,
        hasError: false
    });
    const [statusState, setStatusState] = useState({
        key: sourceKey,
        value: url ? 'loading' : 'empty'
    });
    const resolvedUrl = url
        && resolvedSourceState.key === pdfSourceKey
        && !resolvedSourceState.hasError
        ? resolvedSourceState.url
        : null;
    const effectiveStatus = !url
        ? 'empty'
        : resolvedSourceState.key !== pdfSourceKey || !resolvedUrl
            ? (resolvedSourceState.key === pdfSourceKey && resolvedSourceState.hasError ? 'error' : 'loading')
            : (statusState.key === sourceKey ? statusState.value : 'loading');
    const normalizedPreloadPages = useMemo(() => {
        const pages = new Set(preloadPages.map(normalizePageNumber));
        pages.delete(targetPage);
        return Array.from(pages).slice(0, 8);
    }, [preloadPages, targetPage]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return undefined;

        const updateSize = () => {
            const rect = element.getBoundingClientRect();
            setContainerSize({
                width: Math.max(1, Math.floor(rect.width)),
                height: Math.max(1, Math.floor(rect.height))
            });
        };

        updateSize();

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(element);

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        let isActive = true;

        if (!url) {
            hasPaintedRef.current = false;
            Promise.resolve().then(() => {
                if (isActive) {
                    setResolvedSourceState({
                        key: '',
                        url: null,
                        hasError: false
                    });
                }
            });
            return () => {
                isActive = false;
            };
        }

        let objectUrlToRevoke = null;
        hasPaintedRef.current = false;

        getCachedPdfObjectUrl(url)
            .then(({ objectUrl, shouldRevoke }) => {
                if (!isActive) {
                    if (shouldRevoke) URL.revokeObjectURL(objectUrl);
                    return;
                }

                objectUrlToRevoke = shouldRevoke ? objectUrl : null;
                setResolvedSourceState({
                    key: pdfSourceKey,
                    url: objectUrl,
                    hasError: false
                });
            })
            .catch(() => {
                if (!isActive) return;
                setResolvedSourceState({
                    key: pdfSourceKey,
                    url: null,
                    hasError: true
                });
            });

        return () => {
            isActive = false;
            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
            }
        };
    }, [pdfSourceKey, url]);

    useEffect(() => {
        if (!resolvedUrl) {
            return undefined;
        }

        if (!containerSize.width || !containerSize.height) return undefined;

        const renderToken = renderTokenRef.current + 1;
        renderTokenRef.current = renderToken;

        const shouldShowLoading = !hasPaintedRef.current;
        if (shouldShowLoading) {
            Promise.resolve().then(() => {
                if (renderTokenRef.current === renderToken) {
                    setStatusState({
                        key: sourceKey,
                        value: 'loading'
                    });
                }
            });
        }

        const renderWithRetry = (attempt = 0) => renderPageToCache(resolvedUrl, targetPage, containerSize.width, containerSize.height)
            .catch((error) => {
                if (attempt >= 2) throw error;
                return new Promise((resolve) => {
                    window.setTimeout(resolve, 250 * (attempt + 1));
                }).then(() => renderWithRetry(attempt + 1));
            });

        renderWithRetry()
            .then((renderedPage) => {
                if (renderTokenRef.current !== renderToken || !canvasRef.current) return;

                paintRenderedPage(canvasRef.current, renderedPage);
                hasPaintedRef.current = true;
                setStatusState({
                    key: sourceKey,
                    value: 'ready'
                });

                const runWhenIdle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 50));
                runWhenIdle(() => {
                    normalizedPreloadPages.forEach((page) => {
                        renderPageToCache(resolvedUrl, page, containerSize.width, containerSize.height).catch(() => {});
                    });
                }, { timeout: 1500 });
            })
            .catch(() => {
                if (renderTokenRef.current !== renderToken) return;
                setStatusState({
                    key: sourceKey,
                    value: 'error'
                });
            });

        return undefined;
    }, [containerSize.height, containerSize.width, normalizedPreloadPages, resolvedUrl, sourceKey, targetPage]);

    return (
        <div
            ref={containerRef}
            className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-white ${className || ''}`}
        >
            <canvas
                ref={canvasRef}
                className={`block max-h-full max-w-full ${effectiveStatus === 'ready' ? 'opacity-100' : 'opacity-0'}`}
            />

            {effectiveStatus === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white text-sm font-semibold text-slate-400">
                    PDF 불러오는 중...
                </div>
            )}

            {effectiveStatus === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white text-sm font-semibold text-rose-400">
                    PDF를 불러올 수 없습니다.
                </div>
            )}

            {effectiveStatus === 'empty' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white text-slate-400">
                    No PDF
                </div>
            )}
        </div>
    );
}
