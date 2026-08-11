const inflight = new Map<string, Promise<unknown>>();

/** Same key, concurrent misses: one render, everybody waits on it. */
export const singleFlight = async <T>(key: string, work: () => Promise<T>): Promise<T> => {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const started = work().finally(() => inflight.delete(key));
  inflight.set(key, started);
  return started;
};

export const inflightCount = (): number => inflight.size;
