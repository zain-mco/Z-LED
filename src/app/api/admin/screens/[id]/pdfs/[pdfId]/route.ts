import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFromBunny, cdnUrlToRemotePath } from '@/lib/bunny';

// DELETE: Delete a specific PDF from a screen user (admin only)
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; pdfId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, pdfId } = await params;

    const pdf = await prisma.pdf.findFirst({
        where: { id: pdfId, userId: id },
    });

    if (!pdf) {
        return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
    }

    try {
        const remotePath = cdnUrlToRemotePath(pdf.filepath);
        await deleteFromBunny(remotePath);
    } catch (err) {
        console.error('Failed to delete from CDN:', err);
    }

    await prisma.pdf.delete({ where: { id: pdfId } });

    return NextResponse.json({ success: true });
}
