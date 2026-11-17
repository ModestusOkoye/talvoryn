#!/usr/bin/env python3
"""Offline regression checks: no RPC credentials, no production writes."""
import sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parent))
import refresh_supply as s

def fake_block(height):
    if height in (100,99):
        raise RuntimeError("RPC HTTP 422 method=block params={'block_id': 100} response=UNKNOWN_BLOCK")
    return {'header':{'height':height,'hash':str(height)}}
with patch.object(s,'block',side_effect=fake_block):
    assert s.produced_at_or_before(100)['header']['height']==98
    try:
        s.produced_at_or_before(100,limit=2)
        raise AssertionError('Expected bounded search failure')
    except RuntimeError as e:
        assert 'No produced block' in str(e)
with patch.object(s,'block',side_effect=RuntimeError('RPC HTTP 422 response=invalid API key')):
    try:
        s.produced_at_or_before(100)
        raise AssertionError('Provider authentication error must propagate')
    except RuntimeError as e:
        assert 'invalid API key' in str(e)
assert not s.missing_height(RuntimeError('RPC HTTP 422 response=invalid request'))
assert s.missing_height(ValueError('UNKNOWN_BLOCK'))
print('Offline skipped-height, bounded retry, and provider-error tests passed')
