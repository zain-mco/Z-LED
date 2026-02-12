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

    // We return the path. The middleware will accept this path and proxy the content to BunnyCDN.
    // In a more secure setup, we might sign this or store a temporary token, 
    // but for this implementation we rely on the admin session for the *initial* request 
    // and the middleware will allow the proxy.

    return NextResponse.json({
        remotePath,
        uploadUrl: `/api/upload-proxy?path=${encodeURIComponent(remotePath)}`
    });
}
