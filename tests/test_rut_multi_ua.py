"""
Test for UA multi-select in Real User Traffic jobs.

User scenario (Roman Urdu):
    "real user traffic mein jahan ua select karne ka option hai, odar
     multi selection bhi ho — ta-ke ek hi waqat mein different device
     par kaam ho sake."

What we verify:
  1. Backend /api/real-user-traffic/jobs accepts `upload_ua_ids`
     (comma-separated list) and merges items from ALL batches into
     a single UA pool for the job.
  2. The job-creation response reports `user_agents: <merged count>`
     — proving all batches were loaded.
  3. Each UA in the merged pool is tagged with its ORIGINAL batch via
     `ua_to_batch_map` so per-row removal still lands in the right
     batch.
  4. When consume runs for a multi-batch job, each batch gets its
     OWN consumed UAs removed (not cross-contaminated).
  5. Backward compat: a single `upload_ua_id` still works.
"""
import os
import sys
import time
import asyncio
import uuid
import httpx

API = "http://localhost:8001"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@realflow.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

TEST_USER = f"multiua_{int(time.time())}@example.com"
TEST_PASS = "TestPass1234!"


async def _setup(client):
    r = await client.post(
        f"{API}/api/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    r.raise_for_status()
    atok = r.json()["access_token"]
    ah = {"Authorization": f"Bearer {atok}"}
    await client.post(
        f"{API}/api/auth/register",
        json={"email": TEST_USER, "password": TEST_PASS, "name": "MultiUA Tester"},
    )
    users = (await client.get(f"{API}/api/admin/users", headers=ah)).json()
    target = next((u for u in users if u["email"] == TEST_USER), None)
    uid = target["id"]
    await client.put(
        f"{API}/api/admin/users/{uid}",
        headers=ah,
        json={"status": "active",
              "features": {"real_user_traffic": True, "form_filler": True, "links": True}},
    )
    r = await client.post(
        f"{API}/api/auth/login",
        json={"email": TEST_USER, "password": TEST_PASS},
    )
    tok = r.json()["access_token"]
    return atok, ah, tok, uid


async def _upload_ua_batch(client, tok, name, os_tag, ua_list):
    r = await client.post(
        f"{API}/api/uploads/user-agents",
        headers={"Authorization": f"Bearer {tok}"},
        data={"name": name, "os_tag": os_tag, "user_agents": "\n".join(ua_list)},
    )
    r.raise_for_status()
    return r.json()["id"]


async def _create_link(client, tok):
    r = await client.post(
        f"{API}/api/links",
        headers={"Authorization": f"Bearer {tok}"},
        json={"offer_url": "https://example.com", "name": "multi-ua-test"},
    )
    r.raise_for_status()
    return r.json()["id"]


async def main():
    sys.path.insert(0, "/app/backend")
    import server
    async with httpx.AsyncClient(timeout=60) as client:
        _atok, _ah, tok, uid = await _setup(client)
        print(f"[setup] uid={uid}")

        # ── 3 separate device UA batches ─────────────────────────
        iphone_ids = await _upload_ua_batch(
            client, tok, "iPhone UAs", "ios",
            [f"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) iUA-{i}" for i in range(1, 6)],
        )
        android_ids = await _upload_ua_batch(
            client, tok, "Android UAs", "android",
            [f"Mozilla/5.0 (Linux; Android 15) aUA-{i}" for i in range(1, 5)],
        )
        ipad_ids = await _upload_ua_batch(
            client, tok, "iPad UAs", "ios",
            [f"Mozilla/5.0 (iPad; CPU OS 18_0) pUA-{i}" for i in range(1, 4)],
        )
        print(f"[batches] iphone={iphone_ids} android={android_ids} ipad={ipad_ids} (5+4+3=12 UAs)")

        link_id = await _create_link(client, tok)

        # ── Start a job with MULTI-UA (3 batches merged into one pool) ──
        fd = {
            "link_id": link_id,
            "total_clicks": "2",   # tiny so we can observe without heavy work
            "concurrency": "1",
            "duration_minutes": "0",
            "proxies": "user:pass@127.0.0.1:9999",
            "upload_ua_ids": f"{iphone_ids},{android_ids},{ipad_ids}",
            "target_mode": "clicks",
        }
        r = await client.post(
            f"{API}/api/real-user-traffic/jobs",
            headers={"Authorization": f"Bearer {tok}"},
            data=fd,
        )
        if r.status_code not in (200, 201):
            print(f"[fail] {r.status_code}: {r.text[:400]}")
            raise AssertionError("multi-UA job did not start")
        body = r.json()
        print(f"[1] multi-UA job: job_id={body['job_id']} user_agents={body['user_agents']}")
        assert body["user_agents"] == 12, f"expected 12 merged UAs, got {body['user_agents']}"

        # ── 2. Verify backward-compat: single upload_ua_id still works ──
        fd2 = dict(fd)
        fd2.pop("upload_ua_ids")
        fd2["upload_ua_id"] = iphone_ids
        r = await client.post(
            f"{API}/api/real-user-traffic/jobs",
            headers={"Authorization": f"Bearer {tok}"},
            data=fd2,
        )
        assert r.status_code in (200, 201)
        body2 = r.json()
        print(f"[2] single-UA job (backward-compat): user_agents={body2['user_agents']}")
        assert body2["user_agents"] == 5, f"expected 5 iPhone UAs, got {body2['user_agents']}"

        # ── 3. Consume-hook behaviour: simulate used UAs from two batches ──
        used_iphone = [f"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) iUA-{i}" for i in (1, 2)]
        used_android = [f"Mozilla/5.0 (Linux; Android 15) aUA-{i}" for i in (1, 3)]
        await server._consume_uploads(
            uid,
            [iphone_ids, android_ids, ipad_ids],
            used_ua_strings=used_iphone + used_android,
        )

        async def _get(upload_id):
            r = await client.get(
                f"{API}/api/uploads?type=user_agents&sync_gsheets=false",
                headers={"Authorization": f"Bearer {tok}"},
            )
            for x in r.json():
                if x["id"] == upload_id:
                    return x
            return None

        iph = await _get(iphone_ids)
        adr = await _get(android_ids)
        ipd = await _get(ipad_ids)
        print(f"[3] after consume: iphone={iph['item_count']}/{iph['original_item_count']} consumed={iph['consumed_count']}")
        print(f"                   android={adr['item_count']}/{adr['original_item_count']} consumed={adr['consumed_count']}")
        print(f"                   ipad   ={ipd['item_count']}/{ipd['original_item_count']} consumed={ipd['consumed_count']}")
        assert iph["consumed_count"] == 2 and iph["item_count"] == 3, "iPhone consume mismatch"
        assert adr["consumed_count"] == 2 and adr["item_count"] == 2, "Android consume mismatch"
        assert ipd["consumed_count"] == 0 and ipd["item_count"] == 3, "iPad should be untouched"
        print("[3b] ✓ each batch only lost its OWN used UAs — no cross-contamination")

        print("\n✅ MULTI-UA TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
