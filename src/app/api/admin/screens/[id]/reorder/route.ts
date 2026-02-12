import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PUT: Reorder PDFs for a specific screen user (admin only)
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { orderedIds } = await req.json();

    if (!Array.isArray(orderedIds)) {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Update sort orders in a transaction
    await prisma.$transaction(
        orderedIds.map((pdfId: string, index: number) =>
            prisma.pdf.update({
                where: { id: pdfId },
                data: { sortOrder: index },
            })
        )
    );

    return NextResponse.json({ success: true });
}
