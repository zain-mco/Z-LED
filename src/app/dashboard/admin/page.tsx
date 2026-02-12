'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ScreenUser {
    id: string;
    name: string;
    email: string;
    _count: { pdfs: number };
    createdAt: string;
}

export default function AdminDashboard() {
    const { data: session } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<ScreenUser[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

    const showToast = (message: string, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    async function fetchUsers() {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
            const data = await res.json();
            setUsers(data);
        }
    }

    useEffect(() => {
        if (session?.user?.role === 'admin') {
            fetchUsers();
        }
    }, [session]);

    async function createUser(e: React.FormEvent) {
        e.preventDefault();
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });

        if (res.ok) {
            setShowModal(false);
            setFormData({ name: '', email: '', password: '' });
            fetchUsers();
            showToast('Screen user created');
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to create user', 'error');
        }
    }

    async function deleteUser(id: string) {
        if (!confirm('Delete this screen and all its PDFs?')) return;

        const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
            fetchUsers();
            showToast('Screen deleted');
        } else {
            showToast('Failed to delete', 'error');
        }
    }

    if (!session || session.user.role !== 'admin') {
        return null;
    }

    return (
        <div className="dashboard-content">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Screen Management</h1>
                    <p className="page-subtitle">Create and manage screen users for your kiosk displays</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    + New Screen User
                </button>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>NAME</th>
                            <th>EMAIL</th>
                            <th>PDFS</th>
                            <th>PLAYER URL</th>
                            <th>CREATED</th>
                            <th>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>{user.name}</td>
                                <td>{user.email}</td>
                                <td>
                                    <span className="badge">{user._count.pdfs} files</span>
                                </td>
                                <td>
                                    <code className="url-text" style={{ fontSize: '0.75rem' }}>
                                        /player/{user.id}
                                    </code>
                                </td>
                                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                                            onClick={() => router.push(`/dashboard/admin/screens/${user.id}`)}
                                        >
                                            📂 Manage
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                            onClick={() => {
                                                navigator.clipboard.writeText(
                                                    `${window.location.origin}/player/${user.id}`
                                                );
                                                showToast('URL copied!');
                                            }}
                                        >
                                            📋
                                        </button>
                                        <button
                                            className="btn-icon delete"
                                            onClick={() => deleteUser(user.id)}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
                                    No screen users yet. Click &quot;+ New Screen User&quot; to create one.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Create Screen User</h2>
                        <form onSubmit={createUser}>
                            <div className="form-group">
                                <label>Screen Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. LED 1 - Main Hall"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    className="input-field"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="e.g. led1@zled.com"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    className="input-field"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Min 6 characters"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`toast ${toast.type}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}
