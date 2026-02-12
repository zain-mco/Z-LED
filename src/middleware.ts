import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
    const token = await getToken({ req: request });

    // Protect dashboard routes
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        if (!token) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('callbackUrl', request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Proxy uploads to BunnyCDN to bypass Vercel body limits
    if (request.nextUrl.pathname.startsWith('/api/upload-proxy')) {
        if (!token || token.role !== 'admin') {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const path = request.nextUrl.searchParams.get('path');
        if (!path) {
            return new NextResponse('Missing path', { status: 400 });
        }

        const storageZone = process.env.BUNNY_STORAGE_ZONE || 'mco-cdn';
        const storageHost = process.env.BUNNY_STORAGE_HOST || 'sg.storage.bunnycdn.com';
        const storagePath = process.env.BUNNY_STORAGE_PATH || '/LED';
        const accessKey = process.env.BUNNY_STORAGE_PASSWORD;

        if (!accessKey) {
            return new NextResponse('Storage misconfigured', { status: 500 });
        }

        const url = `https://${storageHost}/${storageZone}${storagePath}/${path}`;

        try {
            // Forward the request to BunnyCDN
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'AccessKey': accessKey,
                    'Content-Type': 'application/octet-stream',
                },
                body: request.body,
                // @ts-ignore - Required for streaming uploads
                duplex: 'half',
            });

            if (!response.ok) {
                const text = await response.text();
                return new NextResponse(`BunnyCDN Error: ${text}`, { status: response.status });
            }

            return new NextResponse('Upload successful', { status: 200 });
        } catch (error) {
            console.error('Proxy error:', error);
            return new NextResponse('Upload failed', { status: 500 });
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/api/upload-proxy'],
};
