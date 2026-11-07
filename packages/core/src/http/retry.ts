export async function retryWithBackOff<T>(
        fn: () => Promise<T>,
        maxAttempts: number,
        isRetryable: (err: unknown) => boolean
    ): Promise<T> {
    let attempt = 0;
    let lastErr: unknown;

    while (attempt <= maxAttempts) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt === maxAttempts || !isRetryable(err)) throw err;
            const base = 250 * Math.pow(2, attempt);
            const jitter = Math.random()* 100;
            await new Promise((r) => setTimeout(r, base + jitter));
            attempt++;
        }
    }
    throw lastErr;

}