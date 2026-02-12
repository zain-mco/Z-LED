import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Get settings for a specific screen user (admin only)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const settings = await prisma.screenSettings.findUnique({
        where: { userId: id },
    });

    return NextResponse.json(settings || { pageDuration: 60 });
}

// PUT: Update settings for a specific screen user (admin only)
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { pageDuration } = await req.json();

    const settings = await prisma.screenSettings.upsert({
        where: { userId: id },
        update: { pageDuration: parseInt(pageDuration) || 60 },
        create: { userId: id, pageDuration: parseInt(pageDuration) || 60 },
    });

    return NextResponse.json(settings);
}
