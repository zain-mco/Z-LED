import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const pdfs = await prisma.pdf.findMany({
        where: { userId },
        orderBy: { sortOrder: 'asc' },
    });

    const settings = await prisma.screenSettings.findUnique({
        where: { userId },
    });

    return NextResponse.json({
        pdfs,
        settings: {
            pageDuration: settings?.pageDuration ?? 60,
        },
        user: {
            name: user.name,
        },
    });
}
