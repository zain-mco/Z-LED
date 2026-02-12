'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider } from '@/components/AuthProvider';

function DashboardShell({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();

    const isAdmin = session?.user?.role === 'admin';
    const initials = session?.user?.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || '?';

    return (
        <div className="dashboard-layout">
            <header className="dashboard-header">
                <div className="dashboard-header-left">
                    <h1>Z-LED</h1>
                    <nav className="nav-links">
                        {isAdmin && (
                            <Link
                                href="/dashboard/admin"
                                className={`nav-link ${pathname === '/dashboard/admin' ? 'active' : ''}`}
                            >
                                User Management
                            </Link>
                        )}
                        <Link
                            href="/dashboard"
                            className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}
                        >
                            {isAdmin ? 'My Screen' : 'My Screen'}
                        </Link>
                    </nav>
                </div>
                <div className="dashboard-header-right">
                    <div className="user-info">
                        <div className="user-avatar">{initials}</div>
                        <span>{session?.user?.name}</span>
                    </div>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                    >
                        Sign Out
                    </button>
                </div>
            </header>
            <main className="dashboard-content">
                {children}
            </main>
        </div>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <DashboardShell>{children}</DashboardShell>
        </AuthProvider>
    );
}
