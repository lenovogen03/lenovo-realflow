"""
End-to-end test for Google-Sheet-backed uploads with per-row consume +
DEPLETED behaviour. Tests the same code paths as a real public Google
Sheet would hit, with `load_rows_from_google_sheet` mocked in-process so
the test is hermetic.

We bypass the HTTP upload endpoints (which validate against the LIVE
sheet at insert time) and seed the `uploaded_resources` collection
directly via Motor — exactly mirroring what the real endpoints would
write after a successful gsheet validation. Then we exercise:

  • `_consume_uploads()`            — the end-of-job hook (in-process)
  • `_load_upload_items()`          — what RUT calls at job startup
  • `_load_upload_data_file()`      — what FormFiller calls

User scenario (Roman Urdu): *"google sheet add kron, public ho ge.
Used row repeat na lagay, sirf used remove ho. Aur agar mein sheet
mein new rows add karoon to auto-pick ho jain."*
"""
import os
import sys
import time
import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

# Bring the live backend module into scope
sys.path.insert(0, "/app/backend")
import server  # noqa: E402

# ───────────────────────────────────────────────────────────────────
# Sheet state — we fully own this in-process
# ───────────────────────────────────────────────────────────────────
SHEET_STATE = {
    "px": [],
    "ua": [],
    "leads": [],
}
URL_KEY = {
    "https://fake.gsheet/px": "px",
    "https://fake.gsheet/ua": "ua",
    "https://fake.gsheet/leads": "leads",
}


async def fake_first_column(url):
    return list(SHEET_STATE.get(URL_KEY.get(url, ""), []))


async def fake_load_rows(url):
    key = URL_KEY.get(url)
    if key == "leads":
        return list(SHEET_STATE.get("leads", []))
    if key in ("px", "ua"):
        return [{"value": v} for v in SHEET_STATE.get(key, [])]
    return []


async def main():
    # Apply the patch BEFORE any code path calls into the gsheet helpers
    server._fetch_gsheet_first_column = fake_first_column  # type: ignore
    server.load_rows_from_google_sheet = fake_load_rows    # type: ignore

    # Use a unique test user_id so we don't pollute other databases
    uid = f"gstest_{int(time.time())}_{uuid.uuid4().hex[:6]}"

    # We'll write directly to the per-user DB
    user_db = server.get_user_db(uid)
    coll = user_db["uploaded_resources"]
    now = datetime.now(timezone.utc)

    async def list_uploads(t=None):
        q = {"user_id": uid}
        if t:
            q["type"] = t
        return [server._upload_doc_to_response(d) async for d in coll.find(q, {"_id": 0})]

    # ── Seed PROXY gsheet upload (8 proxies in the "sheet") ────────
    SHEET_STATE["px"] = [f"px{i}:pw@{i}.{i}.{i}.{i}:8080" for i in range(1, 9)]
    px_id = str(uuid.uuid4())
    await coll.insert_one({
        "id": px_id, "user_id": uid, "type": "proxies",
        "name": "Live PX sheet", "country_tag": "US",
        "items": [], "item_count": 8, "original_item_count": 8,
        "consumed_count": 0, "depleted": False,
        "file_name": "google-sheet (live)",
        "gsheet_url": "https://fake.gsheet/px",
        "consumed_keys": [],
        "created_at": now,
    })

    out = (await list_uploads("proxies"))[0]
    print(f"[1] proxies-gsheet seeded: item_count={out['item_count']} "
          f"original={out['original_item_count']} consumed={out['consumed_count']} "
          f"depleted={out['depleted']} avail={out['available_count']}")
    assert out["item_count"] == 8
    assert out["original_item_count"] == 8
    assert out["depleted"] is False
    assert out["available_count"] == 8

    # ── Live fetch via _load_upload_items (what RUT engine calls) ──
    pickable = await server._load_upload_items(uid, px_id, "proxies")
    print(f"[1b] _load_upload_items returns {len(pickable)} pickable proxies (expected 8)")
    assert len(pickable) == 8

    # ── Consume 5 of them ──────────────────────────────────────────
    used5 = SHEET_STATE["px"][:5]
    await server._consume_uploads(uid, [px_id], used_proxy_raws=used5)
    out = (await list_uploads("proxies"))[0]
    print(f"[2] after consume-5: consumed={out['consumed_count']} "
          f"avail={out['available_count']} depleted={out['depleted']}")
    assert out["consumed_count"] == 5
    assert out["available_count"] == 3
    assert out["depleted"] is False

    # Live fetch must skip consumed
    pickable = await server._load_upload_items(uid, px_id, "proxies")
    print(f"[2b] _load_upload_items after 5 consumed: {len(pickable)} pickable (expected 3)")
    assert len(pickable) == 3
    for c in used5:
        assert c not in pickable, f"consumed proxy {c} re-picked!"

    # ── Consume final 3 → depleted ────────────────────────────────
    await server._consume_uploads(uid, [px_id], used_proxy_raws=SHEET_STATE["px"][5:])
    items = await list_uploads("proxies")
    out = next((x for x in items if x["id"] == px_id), None)
    assert out is not None, "BATCH WAS DELETED — must survive!"
    print(f"[3] after consume-rest: consumed={out['consumed_count']} "
          f"avail={out['available_count']} depleted={out['depleted']} "
          f"depleted_at={out['depleted_at']}")
    assert out["consumed_count"] == 8
    assert out["depleted"] is True
    assert out["depleted_at"]

    # Live fetch should now return 0 pickable
    pickable = await server._load_upload_items(uid, px_id, "proxies")
    assert len(pickable) == 0

    # ── UA gsheet ──────────────────────────────────────────────────
    SHEET_STATE["ua"] = [f"Mozilla/5.0 GS-UA-{i}" for i in range(1, 5)]
    ua_id = str(uuid.uuid4())
    await coll.insert_one({
        "id": ua_id, "user_id": uid, "type": "user_agents",
        "name": "Live UA sheet", "os_tag": "android",
        "items": [], "item_count": 4, "original_item_count": 4,
        "consumed_count": 0, "depleted": False,
        "file_name": "google-sheet (live)",
        "gsheet_url": "https://fake.gsheet/ua",
        "consumed_keys": [],
        "created_at": now,
    })
    await server._consume_uploads(uid, [ua_id], used_ua_strings=SHEET_STATE["ua"][:2])
    out = next(x for x in await list_uploads("user_agents") if x["id"] == ua_id)
    print(f"[4a] UA-gsheet 2/4: consumed={out['consumed_count']} avail={out['available_count']} depleted={out['depleted']}")
    assert out["consumed_count"] == 2
    assert out["depleted"] is False
    await server._consume_uploads(uid, [ua_id], used_ua_strings=SHEET_STATE["ua"][2:])
    out = next(x for x in await list_uploads("user_agents") if x["id"] == ua_id)
    print(f"[4b] UA-gsheet 4/4: consumed={out['consumed_count']} avail={out['available_count']} depleted={out['depleted']}")
    assert out["consumed_count"] == 4
    assert out["depleted"] is True

    # ── Data-file gsheet (leads) ──────────────────────────────────
    SHEET_STATE["leads"] = [
        {"first": f"User{i}", "last": "X",
         "email": f"u{i}@gs.test", "state": "TX", "zip": "75001"}
        for i in range(1, 5)
    ]
    leads_id = str(uuid.uuid4())
    await coll.insert_one({
        "id": leads_id, "user_id": uid, "type": "data_file",
        "name": "Live Leads sheet",
        "items": [], "item_count": 4, "original_item_count": 4,
        "consumed_count": 0, "depleted": False,
        "file_name": "google-sheet (live)",
        "file_path": None,
        "gsheet_url": "https://fake.gsheet/leads",
        "consumed_keys": [],
        "created_at": now,
    })
    # _load_upload_data_file should refetch live and write a temp xlsx
    pair = await server._load_upload_data_file(uid, leads_id)
    assert pair is not None
    print(f"[5a] data-file-gsheet load: tmp={pair[0]} name={pair[1]}")

    # Pretend the job consumed all 4 leads (no pending leftover)
    await server._consume_uploads(
        uid, [leads_id],
        used_proxy_raws=[], used_ua_strings=[],
        pending_leads_path=None,
    )
    out = next(x for x in await list_uploads("data_file") if x["id"] == leads_id)
    print(f"[5b] data-gsheet consume-all-4: consumed={out['consumed_count']} avail={out['available_count']} depleted={out['depleted']}")
    assert out["consumed_count"] == 4
    assert out["depleted"] is True

    # ── Resilience: user adds NEW rows after first consume ─────────
    # New gsheet, consume 2 of 4, then user adds 4 more rows in the
    # sheet → live fetch must return 4+4-2=6 pickable, depleted recomputes.
    SHEET_STATE["px2"] = [f"new{i}:p@9.9.9.{i}:8080" for i in range(1, 5)]
    URL_KEY["https://fake.gsheet/px2"] = "px2"
    px2_id = str(uuid.uuid4())
    await coll.insert_one({
        "id": px2_id, "user_id": uid, "type": "proxies",
        "name": "Live PX sheet 2", "country_tag": "GB",
        "items": [], "item_count": 4, "original_item_count": 4,
        "consumed_count": 0, "depleted": False,
        "gsheet_url": "https://fake.gsheet/px2",
        "consumed_keys": [],
        "created_at": now,
    })
    await server._consume_uploads(uid, [px2_id], used_proxy_raws=SHEET_STATE["px2"][:2])
    # Sanity: 2/4 consumed, depleted=False
    out = next(x for x in await list_uploads("proxies") if x["id"] == px2_id)
    print(f"[7a] px2 after 2/4 consume: consumed={out['consumed_count']} depleted={out['depleted']}")
    assert out["consumed_count"] == 2
    assert out["depleted"] is False

    # User adds 4 more rows in their sheet
    SHEET_STATE["px2"] = SHEET_STATE["px2"] + [f"newer{i}:p@8.8.8.{i}:8080" for i in range(1, 5)]
    pickable = await server._load_upload_items(uid, px2_id, "proxies")
    print(f"[7b] sheet edited (4→8 rows), 2 consumed: live-fetch {len(pickable)} pickable (expected 6)")
    assert len(pickable) == 6
    for c in SHEET_STATE["px2"][:2]:  # original first 2 were consumed
        assert c not in pickable

    print("\n✅ ALL GOOGLE-SHEET PER-ROW + DEPLETED TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
