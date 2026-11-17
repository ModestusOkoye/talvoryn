#!/usr/bin/env python3
"""Offline regression tests for the production supply publisher. No network or D1 writes."""
import datetime as dt
import json
import runpy
import unittest

p = runpy.run_path("scripts/publish_verified_supply.py", run_name="supply_test")
merge = p["merge"]
validate = p["validate"]
today = (dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1)).isoformat()
next_day = dt.datetime.now(dt.timezone.utc).date().isoformat()

def row(day, mint="100", burn="5"):
    return {"date": day, "mintYocto": mint, "burnYocto": burn,
            "mint": int(mint)/10**24, "burn": int(burn)/10**24,
            "startBlock": "start-" + day, "endBlock": "end-" + day}

def boundary(day):
    return {"before": {"hash": "hash-" + day}}

class PublisherSafety(unittest.TestCase):
    def setUp(self):
        self.old = row("2026-10-31", "99", "2")
        self.new = row(today)
        self.live = {"meta": {"original": True}, "daily": [self.old], "boundaries": {"2026-10-31": boundary("2026-10-31")}}
        self.incoming = {"daily": [self.new], "boundaries": {today: boundary(today), next_day: boundary(next_day)}}

    def test_append_preserves_historical_record_and_boundaries(self):
        merged, added, protected = merge(self.incoming, {today:self.new}, self.live)
        self.assertEqual(added, [today])
        self.assertEqual(merged["daily"][0], self.old)
        self.assertEqual(merged["boundaries"]["2026-10-31"], self.live["boundaries"]["2026-10-31"])
        self.assertIn(today, merged["boundaries"])
        self.assertIn("2026-10-31", protected)
        self.assertEqual(self.live["daily"], [self.old])

    def test_existing_identical_day_is_noop(self):
        live = {**self.live, "daily":[self.old,self.new]}
        merged, added, _ = merge(self.incoming, {today:self.new}, live)
        self.assertEqual(added, [])
        self.assertEqual(merged["daily"], live["daily"])

    def test_conflicting_existing_yocto_refused(self):
        live = {**self.live, "daily":[self.old,row(today,"101","5")]}
        with self.assertRaises(SystemExit):
            merge(self.incoming, {today:self.new}, live)

    def test_conflicting_block_evidence_refused(self):
        live = {**self.live, "daily":[self.old,{**self.new,"endBlock":"wrong"}]}
        with self.assertRaises(SystemExit):
            merge(self.incoming, {today:self.new}, live)

    def test_conflicting_boundary_refused(self):
        live = {**self.live, "boundaries":{today:{"before":{"hash":"wrong"}}}}
        with self.assertRaises(SystemExit):
            merge(self.incoming, {today:self.new}, live)

    def test_duplicate_dates_refused(self):
        with self.assertRaises(SystemExit):
            p["indexed"]([self.new,self.new],"incoming")

    def test_live_history_is_not_mutated(self):
        before = json.dumps(self.live,sort_keys=True)
        merge(self.incoming, {today:self.new}, self.live)
        self.assertEqual(json.dumps(self.live,sort_keys=True),before)

if __name__ == "__main__":
    unittest.main(verbosity=2)
