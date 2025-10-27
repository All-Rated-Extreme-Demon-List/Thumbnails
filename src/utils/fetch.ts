export class FetchError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'FetchError';
        this.status = status;
    }
}

export async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(
            `Failed to fetch JSON: ${url} (status ${response.status})`,
        );
    return response.json();
}

export async function fetchBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
        const error = new FetchError(
            `Failed to fetch buffer: ${url} (${response})`,
            response.status,
        );
        throw error;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
