'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewer({ url, pageNumber, width, scale, className }) {
    const [measuredWidth, setMeasuredWidth] = useState(1000);
    const containerRef = useRef(null);

    // --- State for Rendering ---
    const [buffer, setBuffer] = useState({
        activeSlot: 'A', // 'A' or 'B'
        pageA: pageNumber,
        pageB: null
    });
    const bufferRef = useRef(buffer);

    // Tracks if we are currently "busy" (rendering a page -> waiting for onLoad -> swapping).
    const isProcessing = useRef(false);

    // Track document page count
    const [numPages, setNumPages] = useState(0);
    const numPagesRef = useRef(0);

    // --- Refs for Logic ---
    const targetPageRef = useRef(pageNumber);
    const containerWidth = width || measuredWidth;

    const updateBuffer = useCallback((updater) => {
        setBuffer((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            bufferRef.current = next;
            return next;
        });
    }, []);

    // Initial load handling
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setMeasuredWidth(containerRef.current.clientWidth);
            }
        };

        window.addEventListener('resize', updateWidth);
        const frameId = width ? null : requestAnimationFrame(updateWidth);

        return () => {
            window.removeEventListener('resize', updateWidth);
            if (frameId !== null) {
                cancelAnimationFrame(frameId);
            }
        };
    }, [width]);

    useEffect(() => {
        bufferRef.current = buffer;
    }, [buffer]);

    useEffect(() => {
        numPagesRef.current = numPages;
    }, [numPages]);

    // 1. Process Next Task
    const processNext = useCallback(() => {
        if (isProcessing.current) return;
        const currentBuffer = bufferRef.current;

        // Determine what is currently loaded in the "next" slot (inactive slot)
        const nextSlot = currentBuffer.activeSlot === 'A' ? 'B' : 'A';
        const pageInNextSlot = nextSlot === 'A' ? currentBuffer.pageA : currentBuffer.pageB;

        // Ensure validity
        const target = targetPageRef.current;
        const totalPages = numPagesRef.current;
        if (!target || target < 1 || (totalPages > 0 && target > totalPages)) {
            // Invalid target, stop processing
            return;
        }

        // If the next slot ALREADY has the target page, we just need to swap active.
        if (pageInNextSlot === target) {
            updateBuffer(prev => ({ ...prev, activeSlot: nextSlot }));
            return;
        }

        // If the ACTIVE slot has the target page, no need to do anything
        const pageInActiveSlot = currentBuffer.activeSlot === 'A' ? currentBuffer.pageA : currentBuffer.pageB;
        if (pageInActiveSlot === target) return;

        // Otherwise, load into next slot
        isProcessing.current = true;
        updateBuffer(prev => ({
            ...prev,
            [nextSlot === 'A' ? 'pageA' : 'pageB']: target
        }));
    }, [updateBuffer]);

    // 2. Enqueue new page request
    useEffect(() => {
        targetPageRef.current = pageNumber;
        processNext();
    }, [pageNumber, processNext]);


    // 3. Render Success Callback
    const onPageRenderSuccess = useCallback((slot, renderedPageNum) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (renderedPageNum === targetPageRef.current) {
                    updateBuffer(prev => ({ ...prev, activeSlot: slot }));
                }
                isProcessing.current = false;
                processNext();
            });
        });
    }, [processNext, updateBuffer]);

    // Safety timeout
    useEffect(() => {
        if (!isProcessing.current) return;
        const timer = setTimeout(() => {
            isProcessing.current = false;
            processNext();
        }, 2000);
        return () => clearTimeout(timer);
    }, [buffer, processNext]);

    function onDocumentLoadSuccess({ numPages: nextNumPages }) {
        numPagesRef.current = nextNumPages;
        setNumPages(nextNumPages);
        // Trigger processNext once we know total pages (in case target was waiting)
        requestAnimationFrame(() => processNext());
    }

    // Helper to check if page is renderable
    const isValidPage = (p) => p && numPages > 0 && p <= numPages;

    return (
        <div ref={containerRef} className={`w-full h-full flex items-center justify-center bg-white overflow-hidden relative ${className || ''}`}>
            {url ? (
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div className="text-slate-200">Loading...</div>}
                    error={<div className="text-red-500 text-[10px]">Error</div>}
                    className="flex justify-center w-full h-full relative"
                >
                    {/* Buffer A */}
                    {isValidPage(buffer.pageA) && (
                        <div className={`absolute inset-0 flex items-center justify-center ${buffer.activeSlot === 'A' ? 'z-10' : 'z-0 invisible'}`}>
                            <Page
                                key={`page-a-${buffer.pageA}`}
                                pageNumber={buffer.pageA}
                                width={containerWidth}
                                scale={scale || 1.0}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                loading=""
                                onRenderSuccess={() => onPageRenderSuccess('A', buffer.pageA)}
                                onRenderError={() => { isProcessing.current = false; processNext(); }}
                            />
                        </div>
                    )}

                    {/* Buffer B */}
                    {isValidPage(buffer.pageB) && (
                        <div className={`absolute inset-0 flex items-center justify-center ${buffer.activeSlot === 'B' ? 'z-10' : 'z-0 invisible'}`}>
                            <Page
                                key={`page-b-${buffer.pageB}`}
                                pageNumber={buffer.pageB}
                                width={containerWidth}
                                scale={scale || 1.0}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                loading=""
                                onRenderSuccess={() => onPageRenderSuccess('B', buffer.pageB)}
                                onRenderError={() => { isProcessing.current = false; processNext(); }}
                            />
                        </div>
                    )}
                </Document>

            ) : (
                <div className="text-slate-400">No PDF</div>
            )}
        </div>
    );
}
