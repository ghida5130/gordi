from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any


class RunStore:
    """Small file store for a team demo; each run is an independently shareable file."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    def run_dir(self, run_id: str) -> Path:
        return self.root / run_id

    def create(self, run_id: str, data: dict[str, Any]) -> None:
        with self._lock:
            directory = self.run_dir(run_id)
            directory.mkdir(parents=True, exist_ok=False)
            self._write(directory / "run.json", data)

    def get(self, run_id: str) -> dict[str, Any]:
        path = self.run_dir(run_id) / "run.json"
        if not path.is_file():
            raise KeyError(run_id)
        with self._lock:
            return json.loads(path.read_text(encoding="utf-8"))

    def all(self) -> list[dict[str, Any]]:
        runs = []
        with self._lock:
            for path in sorted(self.root.glob("*/run.json")):
                try:
                    runs.append(json.loads(path.read_text(encoding="utf-8")))
                except (OSError, json.JSONDecodeError):
                    continue
        return runs

    def save(self, run_id: str, data: dict[str, Any]) -> None:
        path = self.run_dir(run_id) / "run.json"
        if not path.parent.is_dir():
            raise KeyError(run_id)
        with self._lock:
            self._write(path, data)

    def write_asset(self, run_id: str, filename: str, data: bytes) -> str:
        path = self.run_dir(run_id) / filename
        with self._lock:
            path.write_bytes(data)
        return f"/demo-media/{run_id}/{filename}"

    @staticmethod
    def _write(path: Path, data: dict[str, Any]) -> None:
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        temporary.replace(path)
