import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Public proxy endpoint to serve PDFs from BunnyCDN.
 * This avoids CORS issues when PDF.js tries to load PDFs directly from the CDN.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const pdf = await prisma.pdf.findUnique({
        where: { id },
    });

    if (!pdf) {
        return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
    }

    try {
        // Fetch the PDF from BunnyCDN
        const response = await fetch(pdf.filepath);

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch PDF from storage' },
                { status: 502 }
            );
        }

        const arrayBuffer = await response.arrayBuffer();

        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${pdf.filename}"`,
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (err) {
        console.error('PDF proxy error:', err);
        return NextResponse.json(
            { error: 'Failed to proxy PDF' },
            { status: 500 }
        );
    }
}
