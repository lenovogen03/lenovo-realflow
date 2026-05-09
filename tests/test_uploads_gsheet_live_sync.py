"""
Test the LIVE Google-Sheet auto-sync + auto-undeplete flow.

User scenario (Roman Urdu):
    "live google sheet pr working ho — mein aik google sheet add kron,
     phr os mein se jab data khatam ho jay to mein osi sheet mein ja kr
     new rakh dun, or panel mein auto refresh ho or data idar show ho jay."

Translation: "I want it to work on a live Google Sheet — I add a sheet
once, and when its data runs out (depleted), I add new rows to the
SAME sheet, and the panel auto-refreshes to show the new data without
me having to re-upload anything."

Test coverage:
  1. Seed a 4-row gsheet, fully consume → depleted=True.
  2. Owner "edits" the sheet (we mutate SHEET_STATE) — adds 3 new rows.
  3. GET /api/uploads triggers _refresh_gsheet_doc → item_count grows
     from 4 → 7, depleted clears, available_count=3.
  4. Live-fetch (_load_upload_items) returns the 3 new rows + skips the
     4 already-consumed.
  5. Owner removes 2 unconsumed rows from the sheet (sheet now has 5
     total: 4 consumed + 1 fresh) → next refresh recomputes
     available=1, depleted stays False.
  6. Owner empties the sheet down to ONLY consumed rows → depleted
     re-triggers (consumed=4, sheet=4, available=0).
  7. last_synced_at is populated after every list call.

The HTTP /api/uploads endpoint can't be hit because the backend's
gsheet fetcher is the real `load_rows_from_google_sheet` which would
try to talk to the network. We monkey-patch it in-process and call
the route handler DIRECTLY.
"""
import os
import sys
import time
import asyncio
import uuid
from datetime import datetime, timezone

sys.path.insert(0, "/app/backend")
import server  # noqa: E402

SHEET = {"px": []}
URL = "https://fake.gsheet/px-live"
URL_TO_KEY = {URL: "px"}


async def fake_first_column(url):
    return list(SHEET.get(URL_TO_KEY.get(url, ""), []))


async def fake_load_rows(url):
    key = URL_TO_KEY.get(url)
    return [{"value": v} for v in SHEET.get(key or "", [])]


async def main():
    server._fetch_gsheet_first_column = fake_first_column  # type: ignore
    server.load_rows_from_google_sheet = fake_load_rows    # type: ignore

    uid = f"livesync_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    user_db = server.get_user_db(uid)
    coll = user_db["uploaded_resources"]
    now = datetime.now(timezone.utc)

    # ── Seed: 4-row gsheet, fully consumed → depleted=True ────────
    SHEET["px"] = [f"px{i}:p@1.1.1.{i}:8080" for i in range(1, 5)]
    px_id = str(uuid.uuid4())
    await coll.insert_one({
        "id": px_id, "user_id": uid, "type": "proxies",
        "name": "Live PX", "country_tag": "US",
        "items": [], "item_count": 4, "original_item_count": 4,
        "consumed_count": 0, "depleted": False,
        "gsheet_url": URL, "consumed_keys": [],
        "created_at": now,
    })
    await server._consume_uploads(uid, [px_id], used_proxy_raws=SHEET["px"])
    doc = await coll.find_one({"id": px_id}, {"_id": 0})
    out = server._upload_doc_to_response(doc)
    print(f"[1] after consume-all: consumed={out['consumed_count']} avail={out['available_count']} depleted={out['depleted']}")
    assert out["depleted"] is True
    assert out["available_count"] == 0

    # ── Owner edits sheet: adds 3 new rows ────────────────────────
    SHEET["px"] = SHEET["px"] + [f"new{i}:p@2.2.2.{i}:8080" for i in range(1, 4)]
    print(f"[2] sheet edited → now {len(SHEET['px'])} rows")

    # ── Trigger refresh via the same path GET /api/uploads uses ─
    doc = await coll.find_one({"id": px_id}, {"_id": 0})
    await server._refresh_gsheet_doc(uid, doc)
    fresh = await coll.find_one({"id": px_id}, {"_id": 0})
    out = server._upload_doc_to_response(fresh)
    print(f"[3] after refresh: item_count={out['item_count']} consumed={out['consumed_count']} avail={out['available_count']} depleted={out['depleted']} last_synced_at={out['last_synced_at']}")
    assert out["item_count"] == 7
    assert out["consumed_count"] == 4
    assert out["available_count"] == 3
    assert out["depleted"] is False, "AUTO-UNDEPLETE FAILED — should be False after sheet edit"
    assert out["depleted_at"] is None
    assert out["last_synced_at"]

    # ── Live fetch must return ONLY the 3 new rows ─────────────
    pickable = await server._load_upload_items(uid, px_id, "proxies")
    print(f"[4] _load_upload_items: {len(pickable)} pickable (expected 3 new) — {pickable}")
    assert len(pickable) == 3
    for old in SHEET["px"][:4]:
        assert old not in pickable
    for new in SHEET["px"][4:]:
        assert new in pickable

    # ── Owner removes 2 of the 3 fresh rows from sheet ─────────
    SHEET["px"] = SHEET["px"][:4] + SHEET["px"][4:5]   # 4 consumed + 1 fresh = 5
    doc = await coll.find_one({"id": px_id}, {"_id": 0})
    await server._refresh_gsheet_doc(uid, doc)
    fresh = await coll.find_one({"id": px_id}, {"_id": 0})
    out = server._upload_doc_to_response(fresh)
    print(f"[5] sheet shrunk to 5: item_count={out['item_count']} avail={out['available_count']} depleted={out['depleted']}")
    assert out["item_count"] == 5
    assert out["available_count"] == 1
    assert out["depleted"] is False

    # ── Owner empties sheet down to only consumed rows ─────────
    SHEET["px"] = SHEET["px"][:4]   # 4 consumed only
    doc = await coll.find_one({"id": px_id}, {"_id": 0})
    await server._refresh_gsheet_doc(uid, doc)
    fresh = await coll.find_one({"id": px_id}, {"_id": 0})
    out = server._upload_doc_to_response(fresh)
    print(f"[6] sheet down to consumed-only: item_count={out['item_count']} avail={out['available_count']} depleted={out['depleted']}")
    assert out["item_count"] == 4
    assert out["available_count"] == 0
    assert out["depleted"] is True

    # ── Sheet refilled with brand-new rows (none in consumed_keys) ─
    SHEET["px"] = SHEET["px"][:4] + [f"refill{i}:p@3.3.3.{i}:8080" for i in range(1, 4)]
    doc = await coll.find_one({"id": px_id}, {"_id": 0})
    await server._refresh_gsheet_doc(uid, doc)
    fresh = await coll.find_one({"id": px_id}, {"_id": 0})
    out = server._upload_doc_to_response(fresh)
    print(f"[7] sheet refilled: item_count={out['item_count']} avail={out['available_count']} depleted={out['depleted']}")
    assert out["item_count"] == 7
    assert out["available_count"] == 3
    assert out["depleted"] is False, "AUTO-UNDEPLETE on refill FAILED"

    print("\n✅ ALL LIVE-SYNC + AUTO-UNDEPLETE TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
