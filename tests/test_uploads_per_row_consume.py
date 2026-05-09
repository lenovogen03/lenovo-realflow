"""
End-to-end test for per-row consume + DEPLETED behaviour on uploaded
resources. Mirrors the user's requirement (Roman Urdu):

    "real user traffic mein jo chez use ho wo auto delete ho.
     pehle pori file delete ho jati thi — ab siraf used row remove ho.
     proxy or UA mein bhi same. siraf JSON file remove na ho ku k
     wo dobara same use krni hoti hai."

Test scenarios (driven against the live preview backend):

  1. Upload 5 proxies → simulate consume of 3 → expect 2 remaining,
     batch ALIVE with consumed_count=3, depleted=False.
  2. Same upload → consume remaining 2 → expect item_count=0,
     batch STILL ALIVE, depleted=True.
  3. Upload 4 user-agents → consume all 4 in one shot → batch ALIVE,
     depleted=True, consumed_count=4.
  4. Upload an automation_json template → run consume hook with that
     id (it should be a no-op) → template still alive with same item_count.
  5. Sanity: re-fetching `/api/uploads` returns the depleted entries
     with `depleted=True` and `original_item_count` populated.
"""
import os
import sys
import asyncio
import time
import io
from pathlib import Path

import httpx

API = os.environ.get("API_URL") or "http://localhost:8001"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@realflow.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

# Use a fresh test user so the test is deterministic + isolated
TEST_USER = f"perrowtest_{int(time.time())}@example.com"
TEST_PASS = "TestPass1234!"


async def _admin_token(client):
    r = await client.post(
        f"{API}/api/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    r.raise_for_status()
    return r.json()["access_token"]


async def _register_and_approve(client, admin_tok):
    # 1. Register
    r = await client.post(
        f"{API}/api/auth/register",
        json={"email": TEST_USER, "password": TEST_PASS, "name": "Per-Row Tester"},
    )
    if r.status_code not in (200, 201, 400):
        r.raise_for_status()
    # 2. Find the user, set status=active + features=[real_user_traffic]
    rh = {"Authorization": f"Bearer {admin_tok}"}
    users = (await client.get(f"{API}/api/admin/users", headers=rh)).json()
    target = next((u for u in users if u["email"] == TEST_USER), None)
    assert target, "test user not found after registration"
    uid = target["id"]
    # Activate + grant feature
    await client.put(
        f"{API}/api/admin/users/{uid}",
        headers=rh,
        json={
            "status": "active",
            "features": {"real_user_traffic": True, "form_filler": True},
        },
    )
    # 3. Login as the test user
    r = await client.post(
        f"{API}/api/auth/login",
        json={"email": TEST_USER, "password": TEST_PASS},
    )
    r.raise_for_status()
    return r.json()["access_token"], uid


async def _u(client, tok, path, **kw):
    return await client.post(
        f"{API}{path}",
        headers={"Authorization": f"Bearer {tok}"},
        **kw,
    )


async def _list_uploads(client, tok, type_):
    r = await client.get(
        f"{API}/api/uploads?type={type_}",
        headers={"Authorization": f"Bearer {tok}"},
    )
    r.raise_for_status()
    return r.json()


async def _consume(client, tok, upload_ids, used_proxy_raws=None, used_ua_strings=None):
    """Trigger the test-only consume helper exposed below.
    NOTE: The product code calls `_consume_uploads()` internally at
    end-of-job. We exercise the same function via the test endpoint
    we register at the bottom of server.py. If that endpoint isn't
    available we fall back to importing the function directly.
    """
    # Import the real implementation directly
    sys.path.insert(0, "/app/backend")
    from server import _consume_uploads, get_user_db  # noqa
    # Need user_id — look it up via /auth/me
    me = await client.get(
        f"{API}/api/auth/me",
        headers={"Authorization": f"Bearer {tok}"},
    )
    me.raise_for_status()
    user_id = me.json()["id"]
    await _consume_uploads(
        user_id,
        upload_ids,
        used_proxy_raws=used_proxy_raws or [],
        used_ua_strings=used_ua_strings or [],
    )


async def main():
    async with httpx.AsyncClient(timeout=60) as client:
        admin_tok = await _admin_token(client)
        tok, uid = await _register_and_approve(client, admin_tok)
        print(f"[setup] test user uid={uid}")

        # ── 1. Upload 5 proxies ─────────────────────────────────────
        proxies_raw = "\n".join([f"user{i}:pass@1.2.3.{i}:8080" for i in range(1, 6)])
        r = await _u(
            client, tok, "/api/uploads/proxies",
            data={"name": "test-5-proxies", "country_tag": "US", "proxies": proxies_raw},
        )
        r.raise_for_status()
        proxy_doc = r.json()
        proxy_id = proxy_doc["id"]
        print(f"[1] uploaded 5 proxies: id={proxy_id} item_count={proxy_doc['item_count']} original={proxy_doc['original_item_count']}")
        assert proxy_doc["item_count"] == 5
        assert proxy_doc["original_item_count"] == 5
        assert proxy_doc["consumed_count"] == 0
        assert proxy_doc["depleted"] is False

        # ── 2. Consume 3 of them ────────────────────────────────────
        used3 = [f"user{i}:pass@1.2.3.{i}:8080" for i in range(1, 4)]
        await _consume(client, tok, [proxy_id], used_proxy_raws=used3)
        items = await _list_uploads(client, tok, "proxies")
        d = next(x for x in items if x["id"] == proxy_id)
        print(f"[2] after consume-3: item_count={d['item_count']} consumed_count={d['consumed_count']} depleted={d['depleted']}")
        assert d["item_count"] == 2, f"expected 2 remaining, got {d['item_count']}"
        assert d["consumed_count"] == 3
        assert d["depleted"] is False
        assert d["original_item_count"] == 5

        # ── 3. Consume remaining 2 ──────────────────────────────────
        used2 = [f"user{i}:pass@1.2.3.{i}:8080" for i in range(4, 6)]
        await _consume(client, tok, [proxy_id], used_proxy_raws=used2)
        items = await _list_uploads(client, tok, "proxies")
        d = next((x for x in items if x["id"] == proxy_id), None)
        assert d is not None, "PROXY UPLOAD WAS DELETED — should have been preserved as depleted!"
        print(f"[3] after consume-rest: item_count={d['item_count']} consumed_count={d['consumed_count']} depleted={d['depleted']}")
        assert d["item_count"] == 0
        assert d["consumed_count"] == 5
        assert d["depleted"] is True
        assert d["depleted_at"], "depleted_at timestamp missing"

        # ── 4. Upload 4 UAs and consume all 4 ───────────────────────
        ua_raw = "\n".join([f"Mozilla/5.0 TestUA-{i}" for i in range(1, 5)])
        r = await _u(
            client, tok, "/api/uploads/user-agents",
            data={"name": "test-4-uas", "os_tag": "android", "user_agents": ua_raw},
        )
        r.raise_for_status()
        ua_id = r.json()["id"]
        used_uas = [f"Mozilla/5.0 TestUA-{i}" for i in range(1, 5)]
        await _consume(client, tok, [ua_id], used_ua_strings=used_uas)
        items = await _list_uploads(client, tok, "user_agents")
        d = next((x for x in items if x["id"] == ua_id), None)
        assert d is not None, "UA UPLOAD WAS DELETED — should have been preserved!"
        print(f"[4] UA consume-all: item_count={d['item_count']} consumed_count={d['consumed_count']} depleted={d['depleted']}")
        assert d["item_count"] == 0
        assert d["consumed_count"] == 4
        assert d["depleted"] is True

        # ── 5. JSON automation template — must NEVER be consumed ────
        json_body = '[{"action": "wait", "ms": 100}]'
        r = await _u(
            client, tok, "/api/uploads/automation-json",
            data={"name": "test-template", "automation_json": json_body},
        )
        r.raise_for_status()
        json_id = r.json()["id"]
        # Pretend the orchestrator mistakenly passes the JSON id through
        # the consume hook. The hook should silently ignore it because
        # automation_json type is excluded from _consume_uploads logic.
        await _consume(client, tok, [json_id], used_proxy_raws=["irrelevant"])
        items = await _list_uploads(client, tok, "automation_json")
        d = next((x for x in items if x["id"] == json_id), None)
        assert d is not None, "JSON template was DELETED — must always be preserved!"
        print(f"[5] JSON template after consume-attempt: item_count={d['item_count']} depleted={d['depleted']}")
        assert d["item_count"] == 1, "JSON template item_count changed"
        assert d["depleted"] is False, "JSON template was marked depleted"

        # ── 6. Partial-consume on UA: 2-of-4 ─────────────────────────
        # ensures partial path still works after the full-consume path.
        r = await _u(
            client, tok, "/api/uploads/user-agents",
            data={"name": "test-4-uas-v2", "os_tag": "ios", "user_agents": ua_raw},
        )
        r.raise_for_status()
        ua2_id = r.json()["id"]
        await _consume(
            client, tok, [ua2_id],
            used_ua_strings=["Mozilla/5.0 TestUA-1", "Mozilla/5.0 TestUA-2"],
        )
        items = await _list_uploads(client, tok, "user_agents")
        d = next(x for x in items if x["id"] == ua2_id)
        print(f"[6] UA partial-consume: item_count={d['item_count']} consumed_count={d['consumed_count']} depleted={d['depleted']}")
        assert d["item_count"] == 2
        assert d["consumed_count"] == 2
        assert d["depleted"] is False
        assert d["original_item_count"] == 4

        print("\n✅ ALL PER-ROW CONSUME + DEPLETED TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
