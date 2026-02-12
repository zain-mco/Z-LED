import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let settings = await prisma.screenSettings.findUnique({
        where: { userId: session.user.id },
    });

    if (!settings) {
        settings = await prisma.screenSettings.create({
            data: {
                userId: session.user.id,
                pageDuration: 60,
            },
        });
    }

    return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pageDuration } = await req.json();

    if (!pageDuration || pageDuration < 1) {
        return NextResponse.json(
            { error: 'pageDuration must be at least 1 second' },
            { status: 400 }
        );
    }

    const settings = await prisma.screenSettings.upsert({
        where: { userId: session.user.id },
        update: { pageDuration },
        create: {
            userId: session.user.id,
            pageDuration,
        },
    });

    return NextResponse.json(settings);
}
