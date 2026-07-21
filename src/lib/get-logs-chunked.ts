/**
 * getLogs 를 항상 청크로 나눠 병렬 조회.
 *
 * Giwa Sepolia RPC 는 100k block range 제한, 대부분의 L1 RPC 는 10k-50k 제한.
 * "try full first, fallback" 방식은 항상 실패하는 첫 요청 때문에 매번 wasted round-trip.
 * 처음부터 chunkSize 기준으로 병렬 요청하는 게 안정적이고 빠름.
 */
export async function getLogsChunked<T>(
  fn: (from: bigint, to: bigint) => Promise<T[]>,
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: bigint,
): Promise<T[]> {
  if (fromBlock > toBlock) return [];

  const ranges: Array<[bigint, bigint]> = [];
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end =
      start + chunkSize - 1n > toBlock ? toBlock : start + chunkSize - 1n;
    ranges.push([start, end]);
  }

  if (ranges.length === 1) {
    return fn(ranges[0][0], ranges[0][1]);
  }

  const chunks = await Promise.all(ranges.map(([from, to]) => fn(from, to)));
  return chunks.flat();
}

/** Giwa Sepolia 는 100k block range 제한 - 안전마진 두고 90k */
export const L2_CHUNK_SIZE = 90_000n;
/** Alchemy/Infura L1 기본 10k 제한에 맞춤 */
export const L1_CHUNK_SIZE = 10_000n;
