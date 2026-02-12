import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFromBunny, cdnUrlToRemotePath } from '@/lib/bunny';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const pdf = await prisma.pdf.findFirst({
        where: { id, userId: session.user.id },
    });

    if (!pdf) {
        return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
    }

    // Delete from BunnyCDN
    try {
        const remotePath = cdnUrlToRemotePath(pdf.filepath);
        await deleteFromBunny(remotePath);
    } catch (err) {
        console.error('Failed to delete from CDN:', err);
    }

    await prisma.pdf.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
