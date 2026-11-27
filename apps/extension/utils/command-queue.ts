export function createCommandQueue() {
  let previous: Promise<void> = Promise.resolve();

  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = previous.then(operation);
    previous = result.then(() => undefined, () => undefined);
    return result;
  };
}
