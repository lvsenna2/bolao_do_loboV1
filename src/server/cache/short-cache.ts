import { unstable_cache } from "next/cache";

type AsyncLoader<Arguments extends unknown[], Result> = (...args: Arguments) => Promise<Result>;

export function withShortCache<Arguments extends unknown[], Result>(
  key: string,
  loader: AsyncLoader<Arguments, Result>
): AsyncLoader<Arguments, Result> {
  const cached = unstable_cache(loader, [key], { revalidate: 15 });

  return (...args) => (process.env.NODE_ENV === "test" ? loader(...args) : cached(...args));
}
