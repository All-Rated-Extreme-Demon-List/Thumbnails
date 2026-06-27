export class FetchError extends Error {
    status: number;
    url: string;
    cfRay?: string | null;
    cfMitigated?: string | null;
    bodyStart?: string;

    constructor(
        message: string,
        status: number,
        url: string,
        cfRay?: string | null,
        cfMitigated?: string | null,
        bodyStart?: string,
    ) {
        super(message);
        this.name = 'FetchError';
        this.status = status;
        this.url = url;
        this.cfRay = cfRay;
        this.cfMitigated = cfMitigated;
        this.bodyStart = bodyStart;
    }
}

async function throwFetchError(
    url: string,
    response: Response,
): Promise<never> {
    const bodyStart = await response
        .clone()
        .text()
        .then((text) => text.slice(0, 500))
        .catch(() => '');

    throw new FetchError(
        `Failed to fetch: ${url} (status ${response.status})`,
        response.status,
        url,
        response.headers.get('cf-ray'),
        response.headers.get('cf-mitigated'),
        bodyStart,
    );
}

export async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        headers: {
            accept: 'application/json',
            'user-agent': 'aredl-github-automation/1.0',
        },
    });

    if (!response.ok) await throwFetchError(url, response);

    return response.json();
}

export async function fetchBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url, {
        headers: {
            accept: 'image/*,*/*;q=0.8',
            'user-agent': 'aredl-github-automation/1.0',
        },
    });

    if (!response.ok) await throwFetchError(url, response);

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
