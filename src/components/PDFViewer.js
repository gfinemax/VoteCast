'use client';

import { useEffect, useMemo, useState } from 'react';

const VIEWER_SWITCH_DEBOUNCE_MS = 180;

const buildPdfViewerUrl = (url, pageNumber) => {
    const source = String(url || '').trim();
    if (!source) return '';

    const [baseWithoutHash] = source.split('#');
    const targetPage = Math.max(1, parseInt(pageNumber, 10) || 1);

    return `${baseWithoutHash}#page=${targetPage}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
};

const PDFViewerFrame = ({ viewerUrl }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <>
            {!isLoaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 text-sm font-semibold text-slate-400 transition-opacity">
                    PDF 불러오는 중...
                </div>
            )}
            <iframe
                src={viewerUrl}
                title="PDF Viewer"
                onLoad={() => setIsLoaded(true)}
                className={`h-full w-full border-0 transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
        </>
    );
};

export default function PDFViewer({ url, pageNumber, className }) {
    const viewerUrl = useMemo(() => buildPdfViewerUrl(url, pageNumber), [pageNumber, url]);
    const [stableViewerUrl, setStableViewerUrl] = useState(viewerUrl);

    useEffect(() => {
        if (viewerUrl === stableViewerUrl) return undefined;

        const timeoutId = window.setTimeout(() => {
            setStableViewerUrl(viewerUrl);
        }, VIEWER_SWITCH_DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [stableViewerUrl, viewerUrl]);

    return (
        <div className={`relative w-full h-full overflow-hidden bg-white ${className || ''}`}>
            {stableViewerUrl ? (
                <PDFViewerFrame key={stableViewerUrl} viewerUrl={stableViewerUrl} />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                    No PDF
                </div>
            )}
        </div>
    );
}
