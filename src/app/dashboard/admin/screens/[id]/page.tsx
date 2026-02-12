'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PdfFile {
    id: string;
    filename: string;
    filepath: string;
    sortOrder: number;
}

interface ScreenUser {
    id: string;
    name: string;
    email: string;
}

function SortableItem({
    pdf,
    onDelete,
}: {
    pdf: PdfFile;
    onDelete: (id: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: pdf.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="pdf-item">
            <button className="drag-handle" {...attributes} {...listeners}>
                ⠿
            </button>
            <div className="pdf-info">
                <span className="pdf-name">📄 {pdf.filename}</span>
            </div>
            <button className="btn-icon delete" onClick={() => onDelete(pdf.id)}>
                🗑️
            </button>
        </div>
    );
}

export default function AdminScreenPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const screenId = params.id as string;

    const [user, setUser] = useState<ScreenUser | null>(null);
    const [pdfs, setPdfs] = useState<PdfFile[]>([]);
    const [pageDuration, setPageDuration] = useState(60);
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
    const [dragOver, setDragOver] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const showToast = (message: string, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Fetch screen user info
    useEffect(() => {
        async function fetchUser() {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const users: ScreenUser[] = await res.json();
                const found = users.find((u) => u.id === screenId);
                if (found) setUser(found);
                else router.push('/dashboard/admin');
            }
        }
        fetchUser();
    }, [screenId, router]);

    // Fetch PDFs
    const fetchPdfs = useCallback(async () => {
        const res = await fetch(`/api/admin/screens/${screenId}/pdfs`);
        if (res.ok) {
            const data = await res.json();
            setPdfs(data);
        }
    }, [screenId]);

    // Fetch settings
    const fetchSettings = useCallback(async () => {
        const res = await fetch(`/api/admin/screens/${screenId}/settings`);
        if (res.ok) {
            const data = await res.json();
            setPageDuration(data.pageDuration || 60);
        }
    }, [screenId]);

    useEffect(() => {
        fetchPdfs();
        fetchSettings();
    }, [fetchPdfs, fetchSettings]);

    // Upload files
    async function handleUpload(files: FileList | null) {
        if (!files || files.length === 0) return;

        setUploading(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const file of Array.from(files)) {
                if (file.type !== 'application/pdf') {
                    showToast(`Skipped ${file.name} (not a PDF)`, 'error');
                    continue;
                }

                try {
                    // 1. Get signed credentials
                    const signRes = await fetch('/api/admin/uploads/sign', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename: file.name, userId: screenId }),
                    });

                    if (!signRes.ok) throw new Error('Failed to get upload credentials');
                    const { remotePath, accessKey, storageHost, storageZone, storagePath } = await signRes.json();

                    // 2. Upload DIRECTLY to BunnyCDN
                    // Note: This requires BunnyCDN to accept PUT from this origin (CORS).
                    // If CORS fails, we might need a different approach, but direct is the only way to bypass Vercel 4.5MB limit.
                    const uploadUrl = `https://${storageHost}/${storageZone}${storagePath}/${remotePath}`;

                    const uploadRes = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: {
                            'AccessKey': accessKey,
                            'Content-Type': 'application/octet-stream',
                        },
                        body: file,
                    });

                    if (!uploadRes.ok) {
                        const errText = await uploadRes.text();
                        console.error('BunnyCDN Error:', errText);
                        throw new Error(`Failed to upload to CDN: ${uploadRes.status}`);
                    }

                    // 3. Save metadata
                    const saveRes = await fetch(`/api/admin/screens/${screenId}/pdfs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename: file.name, remotePath }),
                    });

                    if (!saveRes.ok) throw new Error('Failed to save metadata');

                    successCount++;
                } catch (err) {
                    console.error(err);
                    failCount++;
                }
            }

            if (successCount > 0) {
                showToast(`${successCount} file(s) uploaded successfully`);
                fetchPdfs();
            }
            if (failCount > 0) {
                showToast(`${failCount} file(s) failed`, 'error');
            }
        } catch {
            showToast('Upload process failed', 'error');
        } finally {
            setUploading(false);
        }
    }

    // Delete PDF
    async function handleDelete(pdfId: string) {
        try {
            const res = await fetch(`/api/admin/screens/${screenId}/pdfs/${pdfId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setPdfs((prev) => prev.filter((p) => p.id !== pdfId));
                showToast('File deleted');
            }
        } catch {
            showToast('Delete failed', 'error');
        }
    }

    // Reorder PDFs
    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = pdfs.findIndex((p) => p.id === active.id);
        const newIndex = pdfs.findIndex((p) => p.id === over.id);
        const newPdfs = arrayMove(pdfs, oldIndex, newIndex);
        setPdfs(newPdfs);

        try {
            await fetch(`/api/admin/screens/${screenId}/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds: newPdfs.map((p) => p.id) }),
            });
            showToast('Order updated');
        } catch {
            showToast('Reorder failed', 'error');
        }
    }

    // Save settings
    async function handleSaveSettings() {
        try {
            const res = await fetch(`/api/admin/screens/${screenId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageDuration }),
            });
            if (res.ok) showToast('Settings saved');
            else showToast('Failed to save', 'error');
        } catch {
            showToast('Failed to save', 'error');
        }
    }

    // Copy player URL
    function copyPlayerUrl() {
        const url = `${window.location.origin}/player/${screenId}`;
        navigator.clipboard.writeText(url);
        showToast('Player URL copied!');
    }

    if (!session || session.user.role !== 'admin') {
        return null;
    }

    const playerUrl = `/player/${screenId}`;

    return (
        <div className="dashboard-content">
            {/* Back button + header */}
            <div style={{ marginBottom: 24 }}>
                <button
                    className="btn btn-secondary"
                    onClick={() => router.push('/dashboard/admin')}
                    style={{ marginBottom: 16 }}
                >
                    ← Back to Screens
                </button>
                <h1 className="page-title">
                    📺 {user?.name || 'Screen'}
                </h1>
                <p className="page-subtitle">{user?.email}</p>
            </div>

            {/* Player URL section */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3>🔗 Player URL</h3>
                <div className="player-url-row">
                    <code className="player-url">{playerUrl}</code>
                    <button className="btn btn-secondary" onClick={copyPlayerUrl}>
                        📋 Copy Full URL
                    </button>
                    <a
                        href={playerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                    >
                        🔗 Open
                    </a>
                </div>
            </div>

            {/* Settings */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3>⚙️ Display Settings</h3>
                <div className="settings-row">
                    <label>
                        Seconds per page:
                        <input
                            type="number"
                            min="5"
                            max="600"
                            value={pageDuration}
                            onChange={(e) => setPageDuration(parseInt(e.target.value) || 60)}
                            className="input-field"
                            style={{ width: 100, marginLeft: 12 }}
                        />
                    </label>
                    <button className="btn btn-primary" onClick={handleSaveSettings}>
                        Save Settings
                    </button>
                </div>
            </div>

            {/* Upload zone */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3>📤 Upload PDFs</h3>
                <div
                    className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        handleUpload(e.dataTransfer.files);
                    }}
                    onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.accept = '.pdf';
                        input.onchange = (e) => handleUpload((e.target as HTMLInputElement).files);
                        input.click();
                    }}
                >
                    {uploading ? (
                        <>
                            <div className="spinner" />
                            <p>Uploading...</p>
                        </>
                    ) : (
                        <>
                            <p className="upload-icon">📁</p>
                            <p>Drag & drop PDF files here or click to browse</p>
                        </>
                    )}
                </div>
            </div>

            {/* PDF list */}
            <div className="card">
                <h3>📄 PDF Files ({pdfs.length})</h3>
                {pdfs.length === 0 ? (
                    <p className="empty-state">No PDFs uploaded yet. Upload files above.</p>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={pdfs.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                            <div className="pdf-list">
                                {pdfs.map((pdf) => (
                                    <SortableItem key={pdf.id} pdf={pdf} onDelete={handleDelete} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className={`toast ${toast.type}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}
