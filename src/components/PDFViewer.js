'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Worker 설정 (CDN 사용)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function PDFViewer({ url, pageNumber, className }) {
    const [containerWidth, setContainerWidth] = useState(null);
    const [containerHeight, setContainerHeight] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth);
                setContainerHeight(containerRef.current.clientHeight);
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const targetPage = Math.max(1, parseInt(pageNumber, 10) || 1);

    return (
        <div 
            ref={containerRef}
            className={`relative w-full h-full overflow-hidden bg-white flex items-center justify-center ${className || ''}`}
        >
            {url ? (
                <Document
                    file={url}
                    loading={
                        <div className="text-sm font-semibold text-slate-400">
                            PDF 불러오는 중...
                        </div>
                    }
                    error={
                        <div className="text-sm font-semibold text-rose-400">
                            PDF를 불러올 수 없습니다.
                        </div>
                    }
                >
                    <Page
                        pageNumber={targetPage}
                        width={containerWidth}
                        height={containerHeight}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                        className="shadow-2xl"
                    />
                </Document>
            ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                    No PDF
                </div>
            )}
        </div>
    );
}
