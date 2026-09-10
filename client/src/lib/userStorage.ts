// Never fall back to the old, shared keys: their owner is unknown.
export function userStorageKey(userId: number | null | undefined, name: string): string | null {
    return userId == null ? null : `user:${userId}:${name}`;
}

export function readUserStorage<T>(userId: number | null | undefined, name: string, fallback: T): T {
    const key = userStorageKey(userId, name);
    if (!key) return fallback;
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw) ?? fallback;
    } catch {
        return fallback;
    }
}

export function writeUserStorage(userId: number | null | undefined, name: string, value: unknown): void {
    const key = userStorageKey(userId, name);
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Private browsing or a full storage must not interrupt task solving.
    }
}
