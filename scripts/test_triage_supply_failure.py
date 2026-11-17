#!/usr/bin/env python3
"""Offline tests for incident classification. No GitHub or Cloudflare calls."""
import runpy
import unittest

module = runpy.run_path("scripts/triage_supply_failure.py", run_name="test_module")
class TriageTests(unittest.TestCase):
    def test_request_specific_403(self):
        result = module["classify"]("Publish", "HTTP Error 403: Forbidden",
                                    [{"status": 200}, {"status": 200}])
        self.assertIn("request-specific", result[0])
    def test_conflict_never_auto_repairs(self):
        result = module["classify"]("Publish", "boundary evidence conflict", [])
        self.assertIn("STOP", result[1])
    def test_rate_limit(self):
        result = module["classify"]("Reconstruct", "HTTP Error 429", [])
        self.assertEqual(result[0], "Rate limiting")
    def test_unknown(self):
        result = module["classify"]("Other", "unexpected exception", [])
        self.assertEqual(result[0], "Unclassified workflow failure")
if __name__ == "__main__":
    unittest.main(verbosity=2)
