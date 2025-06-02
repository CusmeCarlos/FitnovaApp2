export interface User {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    role: 'user' | 'trainer' | 'admin';
    createdAt: Date;
    emailVerified: boolean;
}