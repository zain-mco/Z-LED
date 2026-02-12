'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PdfFile {
    id: string;
    filename: string;
    filepath: string;
    sortOrder: number;
}

function SortablePdfItem({
    pdf,
    index,
    onDelete,
}: {
    pdf: PdfFile;
    index: number;
    onDelete: (id: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: pdf.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`pdf-item ${isDragging ? 'dragging' : ''}`}
        >
            <span className="pdf-drag-handle" {...attributes} {...listeners}>
                ⠿
            </span>
            <div className="pdf-icon">📄</div>
            <div className="pdf-info">
                <div className="pdf-name">{pdf.filename}</div>
                <div className="pdf-order">Priority #{index + 1}</div>
            </div>
            <div className="pdf-actions">
                <button
                    className="btn-icon danger"
                    onClick={() => onDelete(pdf.id)}
                    title="Delete PDF"
                >
                    🗑
                </button>
            </div>
        </div>
    );
}

export default function UserDashboard() {
    const { data: session } = useSession();
    const [pdfs, setPdfs] = useState<PdfFile[]>([]);
    const [duration, setDuration] = useState(60);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const showToast = (message: string, type: string = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchData = useCallback(async () => {
        const [pdfsRes, settingsRes] = await Promise.all([
            fetch('/api/pdfs'),
            fetch('/api/settings'),
        ]);

        if (pdfsRes.ok) {
            const data = await pdfsRes.json();
            setPdfs(data);
        }

        if (settingsRes.ok) {
            const data = await settingsRes.json();
            setDuration(data.pageDuration);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            if (files[i].type === 'application/pdf') {
                formData.append('files', files[i]);
            }
        }

        const res = await fetch('/api/pdfs', {
            method: 'POST',
            body: formData,
        });

        if (res.ok) {
            showToast(`${files.length} file(s) uploaded successfully`);
            fetchData();
        } else {
            showToast('Failed to upload files', 'error');
        }

        setUploading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this PDF?')) return;

        const res = await fetch(`/api/pdfs/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('PDF deleted');
            fetchData();
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = pdfs.findIndex((p) => p.id === active.id);
        const newIndex = pdfs.findIndex((p) => p.id === over.id);

        const newPdfs = arrayMove(pdfs, oldIndex, newIndex);
        setPdfs(newPdfs);

        // Save new order to server
        await fetch('/api/pdfs/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds: newPdfs.map((p) => p.id) }),
        });

        showToast('Order updated');
    };

    const handleDurationChange = async (value: number) => {
        setDuration(value);

        await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageDuration: value }),
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        handleUpload(e.dataTransfer.files);
    };

    if (loading) {
        return (
            <div className="empty-state">
                <div className="spinner" />
                <p>Loading...</p>
            </div>
        );
    }

    const playerUrl = session?.user?.id
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/player/${session.user.id}`
        : '';

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>My Screen</h2>
                    <p>Upload and manage PDF files for your kiosk display</p>
                </div>
            </div>

            {/* Player URL */}
            {session?.user?.id && (
                <div className="player-link-box">
                    <span className="link-label">🖥️ Player URL</span>
                    <span className="link-text">{playerUrl}</span>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                            navigator.clipboard.writeText(playerUrl);
                            showToast('Player URL copied!');
                        }}
                    >
                        Copy
                    </button>
                    <a
                        href={`/player/${session.user.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                    >
                        Open
                    </a>
                </div>
            )}

            {/* Settings */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                    <h3>⚙️ Display Settings</h3>
                </div>
                <div className="setting-item">
                    <label>Seconds per page:</label>
                    <input
                        type="number"
                        min={1}
                        max={3600}
                        value={duration}
                        onChange={(e) => handleDurationChange(parseInt(e.target.value) || 60)}
                    />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Each PDF page will display for {duration} second{duration !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Upload Zone */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                    <h3>📤 Upload PDFs</h3>
                </div>
                <div
                    className={`upload-zone ${dragging ? 'dragging' : ''}`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="upload-zone-icon">{uploading ? '⏳' : '📁'}</div>
                    <h4>{uploading ? 'Uploading...' : 'Drop PDF files here or click to browse'}</h4>
                    <p>You can upload multiple PDF files at once</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => handleUpload(e.target.files)}
                    />
                </div>
            </div>

            {/* PDF List */}
            <div className="card">
                <div className="card-header">
                    <h3>📋 PDF Queue ({pdfs.length} file{pdfs.length !== 1 ? 's' : ''})</h3>
                </div>

                {pdfs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📄</div>
                        <h3>No PDFs Uploaded</h3>
                        <p>Upload PDF files above to start building your slideshow</p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={pdfs.map((p) => p.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="pdf-list">
                                {pdfs.map((pdf, index) => (
                                    <SortablePdfItem
                                        key={pdf.id}
                                        pdf={pdf}
                                        index={index}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}

                {pdfs.length > 0 && (
                    <p style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        💡 Drag and drop to reorder. Files play in this order on the kiosk display.
                    </p>
                )}
            </div>

            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.message}
                </div>
            )}
        </>
    );
}
