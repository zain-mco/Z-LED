'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
    interface Window {
        pdfjsLib: any;
    }
}

interface PdfFile {
    id: string;
    filename: string;
    filepath: string;
    sortOrder: number;
}

interface PlayerData {
    pdfs: PdfFile[];
    settings: { pageDuration: number };
    user: { name: string };
}

interface FlatPage {
    pdfIndex: number;
    pageNumber: number;
    totalPagesInPdf: number;
    pdfFilename: string;
}

// Load PDF.js by injecting a native <script type="module"> tag
function loadPdfJs(): Promise<any> {
    return new Promise((resolve, reject) => {
        // Already loaded
        if (window.pdfjsLib) {
            resolve(window.pdfjsLib);
            return;
        }

        // Listen for the ready event
        const onReady = () => {
            window.removeEventListener('pdfjsReady', onReady);
            if (window.pdfjsLib) {
                resolve(window.pdfjsLib);
            } else {
                reject(new Error('pdfjsLib not available after init'));
            }
        };
        window.addEventListener('pdfjsReady', onReady);

        // Check if script already injected
        if (!document.getElementById('pdfjs-init')) {
            const script = document.createElement('script');
            script.id = 'pdfjs-init';
            script.type = 'module';
            script.src = '/pdfjs/init.mjs';
            script.onerror = () => {
                window.removeEventListener('pdfjsReady', onReady);
                reject(new Error('Failed to load PDF.js init script'));
            };
            document.head.appendChild(script);
        }

        // Timeout fallback
        setTimeout(() => {
            window.removeEventListener('pdfjsReady', onReady);
            if (window.pdfjsLib) {
                resolve(window.pdfjsLib);
            } else {
                reject(new Error('PDF.js loading timed out'));
            }
        }, 10000);
    });
}

export default function PlayerPage() {
    const params = useParams();
    const userId = params.userId as string;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    const [playerData, setPlayerData] = useState<PlayerData | null>(null);
    const [flatPages, setFlatPages] = useState<FlatPage[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [touched, setTouched] = useState(false);
    const [pdfDocs, setPdfDocs] = useState<any[]>([]);
    const [transitioning, setTransitioning] = useState(false);

    // Fetch player data
    useEffect(() => {
        async function fetchData() {
            try {
                const pdfjsLib = await loadPdfJs();

                const res = await fetch(`/api/player/${userId}`);
                if (!res.ok) {
                    setError('Screen not found');
                    setLoading(false);
                    return;
                }
                const data: PlayerData = await res.json();
                setPlayerData(data);

                if (data.pdfs.length === 0) {
                    setLoading(false);
                    return;
                }

                // Load all PDFs
                const docs: any[] = [];
                const pages: FlatPage[] = [];

                for (let i = 0; i < data.pdfs.length; i++) {
                    const pdf = data.pdfs[i];
                    try {
                        // Use proxy endpoint to avoid CORS issues with BunnyCDN
                        const proxyUrl = `/api/pdfs/proxy/${pdf.id}`;
                        const doc = await pdfjsLib.getDocument(proxyUrl).promise;
                        docs.push(doc);

                        for (let p = 1; p <= doc.numPages; p++) {
                            pages.push({
                                pdfIndex: i,
                                pageNumber: p,
                                totalPagesInPdf: doc.numPages,
                                pdfFilename: pdf.filename,
                            });
                        }
                    } catch (err) {
                        console.error(`Failed to load PDF: ${pdf.filename}`, err);
                    }
                }

                setPdfDocs(docs);
                setFlatPages(pages);
                setLoading(false);
            } catch (err) {
                console.error('Failed to initialize:', err);
                setError('Failed to load player');
                setLoading(false);
            }
        }

        fetchData();
    }, [userId]);

    // Render current page
    const renderPage = useCallback(
        async (index: number) => {
            if (flatPages.length === 0 || pdfDocs.length === 0 || !canvasRef.current) return;

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const pageInfo = flatPages[index];
            if (!pageInfo) return;

            const doc = pdfDocs[pageInfo.pdfIndex];
            if (!doc) return;

            try {
                const page = await doc.getPage(pageInfo.pageNumber);

                const containerWidth = window.innerWidth;
                const containerHeight = window.innerHeight;
                const viewport = page.getViewport({ scale: 1 });

                const scaleX = containerWidth / viewport.width;
                const scaleY = containerHeight / viewport.height;
                const scale = Math.min(scaleX, scaleY);

                const scaledViewport = page.getViewport({ scale });

                const dpr = window.devicePixelRatio || 1;
                canvas.width = scaledViewport.width * dpr;
                canvas.height = scaledViewport.height * dpr;
                canvas.style.width = `${scaledViewport.width}px`;
                canvas.style.height = `${scaledViewport.height}px`;

                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                await page.render({
                    canvasContext: ctx,
                    viewport: scaledViewport,
                }).promise;
            } catch (err) {
                console.error('Failed to render page:', err);
            }
        },
        [flatPages, pdfDocs]
    );

    useEffect(() => {
        if (!loading && flatPages.length > 0) {
            setTransitioning(true);
            setTimeout(() => {
                renderPage(currentIndex);
                setTimeout(() => setTransitioning(false), 50);
            }, 250);
        }
    }, [currentIndex, loading, flatPages, renderPage]);

    useEffect(() => {
        const handleResize = () => renderPage(currentIndex);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [currentIndex, renderPage]);

    // Auto-advance timer
    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!playerData || flatPages.length === 0) return;

        const duration = playerData.settings.pageDuration;
        setProgress(0);

        let elapsed = 0;
        timerRef.current = setInterval(() => {
            elapsed += 1;
            setProgress((elapsed / duration) * 100);

            if (elapsed >= duration) {
                setCurrentIndex((prev) => (prev + 1) % flatPages.length);
                elapsed = 0;
                setProgress(0);
            }
        }, 1000);
    }, [playerData, flatPages]);

    useEffect(() => {
        if (!loading && flatPages.length > 0) {
            startTimer();
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [loading, flatPages, startTimer]);

    const goNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % flatPages.length);
        startTimer();
    }, [flatPages, startTimer]);

    const goPrev = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + flatPages.length) % flatPages.length);
        startTimer();
    }, [flatPages, startTimer]);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
        };
        setTouched(true);
        setTimeout(() => setTouched(false), 3000);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;

        const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
        const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX < 0) goNext();
            else goPrev();
        }

        touchStartRef.current = null;
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ') goNext();
            else if (e.key === 'ArrowLeft') goPrev();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goNext, goPrev]);

    if (loading) {
        return (
            <div className="player-loading">
                <div className="spinner" />
                <p>Loading presentation...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="player-empty">
                <h2>⚠️ {error}</h2>
                <p>Please check the URL and try again.</p>
            </div>
        );
    }

    if (!playerData || flatPages.length === 0) {
        return (
            <div className="player-empty">
                <h2>📄 No Content</h2>
                <p>No PDF files have been uploaded for this screen yet.</p>
                <p style={{ marginTop: 8, fontSize: '0.8rem' }}>
                    Upload files from the admin dashboard to get started.
                </p>
            </div>
        );
    }

    const currentPage = flatPages[currentIndex];

    return (
        <div
            className={`player-container ${touched ? 'touched' : ''}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div
                className="player-canvas-wrapper"
                style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 0.25s ease' }}
            >
                <canvas ref={canvasRef} />
            </div>

            <div className="player-touch-zone-left" onClick={goPrev} />
            <div className="player-touch-zone-right" onClick={goNext} />

            <div className="player-nav-indicator left">‹</div>
            <div className="player-nav-indicator right">›</div>

            <div className="player-info">
                {currentPage.pdfFilename} — Page {currentPage.pageNumber}/{currentPage.totalPagesInPdf}
                &nbsp;•&nbsp; {currentIndex + 1}/{flatPages.length} total
            </div>

            <div className="player-progress">
                <div className="player-progress-bar" style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
}
