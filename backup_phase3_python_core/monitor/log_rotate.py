from __future__ import annotations

import argparse
import gzip
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

from .resource_monitor import ensure_log_dir

KEEP_LAST_N = 10
_ARCHIVE_DIR_NAME = "archive"


@dataclass
class RotationResult:
    kept: int
    archived: int
    skipped: List[Path]


def _collect_jsonl(log_dir: Path) -> List[Path]:
    return sorted(
        [path for path in log_dir.glob("*.jsonl") if path.is_file()],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )


def rotate_logs(
    log_dir: Path,
    *,
    keep: int = KEEP_LAST_N,
    dry_run: bool = False,
    exclude: Optional[Iterable[Path]] = None,
) -> RotationResult:
    """Rotate JSONL logs by compressing files older than the ``keep`` window."""

    ensure_log_dir(log_dir)
    archive_dir = ensure_log_dir(log_dir / _ARCHIVE_DIR_NAME)

    exclude_set = {path.resolve() for path in (exclude or [])}

    candidates = _collect_jsonl(log_dir)
    kept = 0
    archived = 0
    skipped: List[Path] = []

    for index, path in enumerate(candidates):
        resolved = path.resolve()
        if resolved in exclude_set:
            kept += 1
            continue
        if index < keep:
            kept += 1
            continue
        try:
            with path.open("rb"):
                pass
        except OSError:
            skipped.append(path)
            continue
        archive_name = f"{path.name}.gz"
        archive_path = archive_dir / archive_name
        if dry_run:
            archived += 1
            continue
        try:
            with path.open("rb") as source, gzip.open(archive_path, "wb") as target:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    target.write(chunk)
            path.unlink()
            archived += 1
        except OSError:
            skipped.append(path)
            if archive_path.exists():
                try:
                    archive_path.unlink()
                except OSError:
                    pass
    return RotationResult(kept=kept, archived=archived, skipped=skipped)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Rotate monitoring JSONL logs safely.")
    parser.add_argument("log_dir", nargs="?", default=None, help="Directory containing JSONL logs")
    parser.add_argument("--keep", type=int, default=KEEP_LAST_N, help="Number of recent logs to keep uncompressed")
    parser.add_argument("--dry-run", action="store_true", help="Preview actions without modifying files")
    parser.add_argument("--exclude", action="append", default=[], help="Paths to exclude from rotation")
    return parser


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    from .resource_monitor import default_log_dir

    log_dir = Path(args.log_dir) if args.log_dir else default_log_dir()
    exclude = [Path(entry) for entry in args.exclude]
    result = rotate_logs(log_dir, keep=max(args.keep, 0), dry_run=args.dry_run, exclude=exclude)

    print(f"Kept {result.kept} logs; archived {result.archived}; skipped {len(result.skipped)}")
    if result.skipped:
        print("Skipped files:")
        for path in result.skipped:
            print(f" - {path}")
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())
