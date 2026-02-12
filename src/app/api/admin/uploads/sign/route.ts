import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cdnUrlToRemotePath } from '@/lib/bunny';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename, userId } = await req.json();

    if (!filename || !userId) {
        return NextResponse.json({ error: 'Missing filename or userId' }, { status: 400 });
    }

    // Generate a unique remote path
    // Format: userId/timestamp-filename
    const uniqueName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const remotePath = `${userId}/${uniqueName}`;

    // For admin users, we provide the direct upload credentials to bypass Vercel limits
    const storageZone = process.env.BUNNY_STORAGE_ZONE || 'mco-cdn';
    const storageHost = process.env.BUNNY_STORAGE_HOST || 'sg.storage.bunnycdn.com';
    const storagePath = process.env.BUNNY_STORAGE_PATH || '/LED';
    const accessKey = process.env.BUNNY_STORAGE_PASSWORD;

    return NextResponse.json({
        remotePath,
        accessKey,
        storageHost,
        storageZone,
        storagePath
    });
}
