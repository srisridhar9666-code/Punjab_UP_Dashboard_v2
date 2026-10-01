"""Tiny in-process response cache for the analytics endpoints.

Survey data only changes when someone uploads a CSV, so results are cached per
(state, data version, endpoint, filters) and the version is bumped on upload.
With several API workers, only the worker that handled the upload is bumped;
the others can serve results up to the TTL (5 minutes) old.
"""

import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Any

_TTL = 300.0
_MAX = 512
_lock = threading.Lock()
_versions: dict[str, int] = {}
_store: "OrderedDict[tuple, tuple[float, Any]]" = OrderedDict()


def bump(state: str) -> None:
    with _lock:
        _versions[state] = _versions.get(state, 0) + 1


def clear() -> None:
    with _lock:
        _store.clear()


def cached(state: str, name: str, params: tuple, compute: Callable[[], Any]) -> Any:
    with _lock:
        key = (state, _versions.get(state, 0), name, params)
        hit = _store.get(key)
        if hit and time.monotonic() - hit[0] < _TTL:
            _store.move_to_end(key)
            return hit[1]
    value = compute()
    with _lock:
        _store[key] = (time.monotonic(), value)
        while len(_store) > _MAX:
            _store.popitem(last=False)
    return value
