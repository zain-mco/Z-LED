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
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Delete PDF files from BunnyCDN
    const pdfs = await prisma.pdf.findMany({ where: { userId: id } });
    for (const pdf of pdfs) {
        try {
            const remotePath = cdnUrlToRemotePath(pdf.filepath);
            await deleteFromBunny(remotePath);
        } catch (err) {
            console.error(`Failed to delete from CDN: ${pdf.filepath}`, err);
        }
    }

    // Delete user (cascades to pdfs and settings)
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
