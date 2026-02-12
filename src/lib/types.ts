import 'next-auth';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
        };
    }

    interface User {
        role: string;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        role: string;
        id: string;
    }
}

export interface PdfFile {
    id: string;
    filename: string;
    filepath: string;
    sortOrder: number;
    userId: string;
    createdAt: string;
}

export interface ScreenUser {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
    _count?: {
        pdfs: number;
    };
}

export interface PlayerData {
    pdfs: PdfFile[];
    settings: {
        pageDuration: number;
    };
    user: {
        name: string;
    };
}
