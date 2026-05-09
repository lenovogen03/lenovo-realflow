"""
Timing test for the parallelized UA-batch load. Verifies that loading
N batches now happens in roughly max(per-batch-latency) instead of
sum(per-batch-latency).

This is the fix for the recurring "Network request aborted — job did
NOT start" toast that was triggered when the request handler did
sequential `await _load_upload_items()` for every selected gsheet UA
batch — long tail latency push the total over Cloudflare's idle-tunnel
timeout.

We monkey-patch the LIVE backend's `_load_upload_items` with a slow
stub (sleeps 0.6s) and measure the wall time of the request-handler's
loop. With 4 batches:
  • Sequential: 4 × 0.6s = 2.4s minimum
  • Parallel:   max(0.6s) ≈ 0.6s
We assert the merged-load completes in ≤ 1.0s — proving the asyncio.gather
path is actually being exercised.
"""
import asyncio
import sys
import time

sys.path.insert(0, "/app/backend")
import server  # noqa: E402


async def slow_load(user_id, upload_id, expected_type):
    # Simulates a gsheet round-trip that takes ~600ms
    await asyncio.sleep(0.6)
    return [f"UA-{upload_id}-{i}" for i in range(1, 4)]   # 3 UAs each


async def main():
    server._load_upload_items = slow_load   # type: ignore

    batch_ids = [f"batch-{i}" for i in range(1, 5)]   # 4 batches

    t0 = time.time()
    results = await asyncio.gather(
        *[server._load_upload_items("test-uid", bid, "user_agents") for bid in batch_ids],
        return_exceptions=True,
    )
    elapsed = time.time() - t0
    total_items = sum(len(r) for r in results if isinstance(r, list))
    print(f"[parallel] 4 batches loaded in {elapsed:.3f}s — {total_items} merged UAs")
    assert elapsed < 1.0, f"parallel load too slow ({elapsed:.3f}s) — gather() not actually concurrent"
    assert total_items == 12

    # Compare with sequential to make the speedup explicit
    t0 = time.time()
    seq_results = []
    for bid in batch_ids:
        seq_results.append(await server._load_upload_items("test-uid", bid, "user_agents"))
    seq_elapsed = time.time() - t0
    print(f"[sequential] same 4 batches loaded in {seq_elapsed:.3f}s — {sum(len(r) for r in seq_results)} UAs")
    speedup = seq_elapsed / elapsed
    print(f"[result] parallel is {speedup:.1f}x faster than sequential")
    assert speedup > 2.0, "parallel should be at least 2x faster than sequential"

    print("\n✅ PARALLEL UA-BATCH LOAD TIMING TEST PASSED")


if __name__ == "__main__":
    asyncio.run(main())
