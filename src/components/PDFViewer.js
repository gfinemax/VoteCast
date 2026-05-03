'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

let pdfjsPromise = null;
const pdfDocumentCache = new Map();
const renderedPageCache = new Map();
const MAX_RENDERED_PAGE_CACHE = 48;

function normalizePageNumber(pageNumber) {
    return Math.max(1, parseInt(pageNumber, 10) || 1);
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
    const [status, setStatus] = useState(url ? 'loading' : 'empty');
    const targetPage = normalizePageNumber(pageNumber);
    const effectiveStatus = url ? status : 'empty';
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
        if (!url) {
            hasPaintedRef.current = false;
            return undefined;
        }

        if (!containerSize.width || !containerSize.height) return undefined;

        const renderToken = renderTokenRef.current + 1;
        renderTokenRef.current = renderToken;

        const shouldShowLoading = !hasPaintedRef.current;
        if (shouldShowLoading) {
            Promise.resolve().then(() => {
                if (renderTokenRef.current === renderToken) {
                    setStatus('loading');
                }
            });
        }

        renderPageToCache(url, targetPage, containerSize.width, containerSize.height)
            .then((renderedPage) => {
                if (renderTokenRef.current !== renderToken || !canvasRef.current) return;

                paintRenderedPage(canvasRef.current, renderedPage);
                hasPaintedRef.current = true;
                setStatus('ready');

                const runWhenIdle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 50));
                runWhenIdle(() => {
                    normalizedPreloadPages.forEach((page) => {
                        renderPageToCache(url, page, containerSize.width, containerSize.height).catch(() => {});
                    });
                }, { timeout: 1500 });
            })
            .catch(() => {
                if (renderTokenRef.current !== renderToken) return;
                setStatus('error');
            });

        return undefined;
    }, [containerSize.height, containerSize.width, normalizedPreloadPages, targetPage, url]);

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
