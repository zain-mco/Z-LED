import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderedIds } = await req.json();

    if (!Array.isArray(orderedIds)) {
        return NextResponse.json(
            { error: 'orderedIds must be an array' },
            { status: 400 }
        );
    }

    // Update sort order for each PDF
    const updates = orderedIds.map((id: string, index: number) =>
        prisma.pdf.updateMany({
            where: { id, userId: session.user.id },
            data: { sortOrder: index },
        })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({ success: true });
}
