import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadToBunny } from '@/lib/bunny';

// GET: List PDFs for a specific screen user (admin only)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const pdfs = await prisma.pdf.findMany({
        where: { userId: id },
        orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(pdfs);
}

// POST: Upload PDFs for a specific screen user (admin only)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
        return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const maxOrder = await prisma.pdf.findFirst({
        where: { userId: id },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
    });

    let currentOrder = (maxOrder?.sortOrder ?? -1) + 1;
    const createdPdfs = [];

    for (const file of files) {
        if (file.type !== 'application/pdf') continue;

        const uniqueName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const remotePath = `${id}/${uniqueName}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        try {
            const cdnUrl = await uploadToBunny(buffer, remotePath);

            const pdf = await prisma.pdf.create({
                data: {
                    filename: file.name,
                    filepath: cdnUrl,
                    sortOrder: currentOrder++,
                    userId: id,
                },
            });

            createdPdfs.push(pdf);
        } catch (err) {
            console.error(`Failed to upload ${file.name}:`, err);
        }
    }

    if (createdPdfs.length === 0) {
        return NextResponse.json({ error: 'Failed to upload files' }, { status: 500 });
    }

    return NextResponse.json(createdPdfs, { status: 201 });
}
