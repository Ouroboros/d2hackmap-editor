#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path


DEFAULT_ISC = r"D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\data\global\excel\ItemStatCost.txt"
DEFAULT_STRING_TABLES = [
    r"D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\center\DuckModString.txt",
    r"D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\center\DuckPermString.txt",
    r"D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\center\ExpansionString.txt",
    r"D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\center\patchstring.txt",
    r"D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\center\string.txt",
]
DEFAULT_OUT = "data/stats.json"
DEFAULT_OVERRIDES = "scripts/stat_name_overrides.json"


def resolve_path(path_text: str) -> Path:
    path = Path(path_text)
    if path.exists():
        return path

    match = re.match(r"^([A-Za-z]):\\(.*)$", path_text)
    if match:
        drive = match.group(1).lower()
        rest = match.group(2).replace("\\", "/")
        wsl_path = Path(f"/mnt/{drive}/{rest}")
        if wsl_path.exists() or Path("/mnt").exists():
            return wsl_path

    return path


def parse_int(value: str | None) -> int | None:
    value = (value or "").strip()
    if not re.fullmatch(r"-?\d+", value):
        return None
    return int(value)


def field(row: dict[str, str], name: str) -> str:
    return (row.get(name) or "").strip()


def normalize_text(value: str) -> str:
    value = re.sub(r"^\d+}", "", value)
    value = value.replace("}", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def load_string_tables(paths: list[str]) -> dict[str, str]:
    strings: dict[str, str] = {}

    for path_text in paths:
        path = resolve_path(path_text)
        if not path.exists():
            raise FileNotFoundError(f"string table not found: {path_text}")

        with path.open("r", encoding="utf-8-sig", errors="replace") as file:
            for line in file:
                line = line.rstrip("\r\n")
                if not line or "\t" not in line:
                    continue
                key, value = line.split("\t", 1)
                key = key.strip()
                if key and key not in strings:
                    strings[key] = normalize_text(value)

    return strings


def load_isc(path_text: str) -> list[dict[str, str]]:
    path = resolve_path(path_text)
    if not path.exists():
        raise FileNotFoundError(f"ItemStatCost.txt not found: {path_text}")

    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as file:
        return list(csv.DictReader(file, delimiter="\t"))


def display_key(row: dict[str, str]) -> str:
    return field(row, "descstrpos") or field(row, "descstrneg")


def base_name(row: dict[str, str], strings: dict[str, str]) -> str:
    key = display_key(row)
    return strings.get(key, key).strip() or key


def stat_name_by_code(
    code: str,
    rows_by_code: dict[str, dict[str, str]],
    strings: dict[str, str],
) -> str:
    row = rows_by_code.get(code)
    if not row:
        return code
    name = base_name(row, strings)
    return name or code


def source_name_by_code(
    code: str,
    rows_by_code: dict[str, dict[str, str]],
    strings: dict[str, str],
) -> str:
    name = stat_name_by_code(code, rows_by_code, strings)
    for suffix in ("值",):
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return name


def calc_range(row: dict[str, str]) -> tuple[int | None, int | None]:
    bits = parse_int(field(row, "Save Bits"))
    if bits is None or bits <= 0:
        return None, None

    signed = field(row, "Signed") == "1"
    save_add = parse_int(field(row, "Save Add")) or 0

    if signed:
        raw_min = -(1 << (bits - 1))
        raw_max = (1 << (bits - 1)) - 1
    else:
        raw_min = 0
        raw_max = (1 << bits) - 1

    return raw_min - save_add, raw_max - save_add


def derived_suffix(
    row: dict[str, str],
    rows_by_code: dict[str, dict[str, str]],
    strings: dict[str, str],
) -> str:
    op = parse_int(field(row, "op")) or 0
    if op in (2, 3, 4, 5):
        source = field(row, "op base")
        if not source:
            return ""
        if source == "level":
            return "(基于等级)"
        return f"(基于{source_name_by_code(source, rows_by_code, strings)})"
    if op in (6, 7):
        return "(基于时间)"
    return ""


def generate_stats(isc_rows: list[dict[str, str]], strings: dict[str, str]) -> list[dict[str, object]]:
    return generate_stats_with_overrides(isc_rows, strings, {})


def generate_stats_with_overrides(
    isc_rows: list[dict[str, str]],
    strings: dict[str, str],
    overrides: dict[str, str],
) -> list[dict[str, object]]:
    rows_by_code = {field(row, "Stat"): row for row in isc_rows if field(row, "Stat")}
    stats: list[dict[str, object]] = []

    for row in isc_rows:
        key = display_key(row)
        if not key:
            continue

        stat_id = parse_int(field(row, "ID"))
        code = field(row, "Stat")
        if stat_id is None or not code:
            continue

        min_value, max_value = calc_range(row)
        generated_name = base_name(row, strings) + derived_suffix(row, rows_by_code, strings)
        stat: dict[str, object] = {
            "id": stat_id,
            "code": code,
            "name": overrides.get(code, generated_name),
        }
        if min_value is not None and max_value is not None:
            stat["min"] = min_value
            stat["max"] = max_value

        stats.append(stat)

    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate data/stats.json from ItemStatCost.txt.")
    parser.add_argument("--isc", default=DEFAULT_ISC, help="Path to ItemStatCost.txt.")
    parser.add_argument(
        "--string-table",
        action="append",
        dest="string_tables",
        help="String table path. Can be specified multiple times. Defaults to mod_dk2024 center tables.",
    )
    parser.add_argument("--out", default=DEFAULT_OUT, help="Output JSON path.")
    parser.add_argument("--overrides", default=DEFAULT_OVERRIDES, help="Optional code-to-name override JSON path.")
    parser.add_argument("--check", action="store_true", help="Print summary without writing output.")
    return parser.parse_args()


def load_overrides(path_text: str) -> dict[str, str]:
    path = resolve_path(path_text)
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"override file must be a JSON object: {path}")
    return {str(key): str(value) for key, value in data.items()}


def main() -> int:
    args = parse_args()
    string_tables = args.string_tables or DEFAULT_STRING_TABLES

    strings = load_string_tables(string_tables)
    isc_rows = load_isc(args.isc)
    overrides = load_overrides(args.overrides)
    stats = generate_stats_with_overrides(isc_rows, strings, overrides)

    if args.check:
        print(f"ISC rows: {len(isc_rows)}")
        print(f"String keys: {len(strings)}")
        print(f"Overrides: {len(overrides)}")
        print(f"Output stats: {len(stats)}")
        for item in stats[:10]:
            print(json.dumps(item, ensure_ascii=False))
        return 0

    out_path = resolve_path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(stats, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(stats)} stats to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
