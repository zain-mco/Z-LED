/**
 * BunnyCDN Storage API helper
 * Uploads files to BunnyCDN storage and returns CDN URLs.
 */

const STORAGE_HOST = process.env.BUNNY_STORAGE_HOST || 'sg.storage.bunnycdn.com';
const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || 'mco-cdn';
const STORAGE_PASSWORD = process.env.BUNNY_STORAGE_PASSWORD || '';
const CDN_URL = process.env.BUNNY_CDN_URL || 'https://mco-cdn.b-cdn.net';
const STORAGE_PATH = process.env.BUNNY_STORAGE_PATH || '/LED';

/**
 * Upload a file to BunnyCDN Storage
 * @param buffer - File content as Buffer
 * @param remotePath - Path within the LED folder (e.g., "userId/filename.pdf")
 * @returns CDN URL of the uploaded file
 */
export async function uploadToBunny(buffer: Buffer, remotePath: string): Promise<string> {
    const url = `https://${STORAGE_HOST}/${STORAGE_ZONE}${STORAGE_PATH}/${remotePath}`;

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            AccessKey: STORAGE_PASSWORD,
            'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(buffer),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`BunnyCDN upload failed: ${response.status} ${text}`);
    }

    // Return the CDN URL for public access
    return `${CDN_URL}${STORAGE_PATH}/${remotePath}`;
}

/**
 * Delete a file from BunnyCDN Storage
 * @param remotePath - Path within the LED folder (e.g., "userId/filename.pdf")
 */
export async function deleteFromBunny(remotePath: string): Promise<void> {
    const url = `https://${STORAGE_HOST}/${STORAGE_ZONE}${STORAGE_PATH}/${remotePath}`;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            AccessKey: STORAGE_PASSWORD,
        },
    });

    if (!response.ok && response.status !== 404) {
        const text = await response.text();
        throw new Error(`BunnyCDN delete failed: ${response.status} ${text}`);
    }
}

/**
 * Extract the remote path from a full CDN URL
 * e.g., "https://mco-cdn.b-cdn.net/LED/userId/file.pdf" → "userId/file.pdf"
 */
export function cdnUrlToRemotePath(cdnUrl: string): string {
    const prefix = `${CDN_URL}${STORAGE_PATH}/`;
    if (cdnUrl.startsWith(prefix)) {
        return cdnUrl.slice(prefix.length);
    }
    // Fallback: try to extract from filepath stored as relative path
    if (cdnUrl.startsWith('/uploads/')) {
        return cdnUrl.replace('/uploads/', '');
    }
    return cdnUrl;
}
