#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


DEFAULT_SKILLS = r"D:\Dev\Source\d2tools\1.10f\goose\mod_dk2024\hackmap\技能ID.txt"
DEFAULT_OUT = "data/skills.json"


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


def parse_skill_line(line: str) -> dict[str, object] | None:
    columns = line.rstrip("\r\n").split("\t")
    if len(columns) < 3:
        return None

    id_text = columns[0].lstrip("\ufeff").strip()
    if not re.fullmatch(r"\d+", id_text):
        return None

    return {
        "id": int(id_text),
        "classCode": columns[1].strip(),
        "name": columns[2].strip(),
    }


def generate_skills(path_text: str) -> list[dict[str, object]]:
    path = resolve_path(path_text)
    if not path.exists():
        raise FileNotFoundError(f"skill data not found: {path_text}")

    skills: list[dict[str, object]] = []
    with path.open("r", encoding="utf-16", errors="replace") as file:
        for line in file:
            item = parse_skill_line(line)
            if item is not None:
                skills.append(item)

    return skills


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate data/skills.json from 技能ID.txt.")
    parser.add_argument("--skills", default=DEFAULT_SKILLS, help="Path to 技能ID.txt.")
    parser.add_argument("--out", default=DEFAULT_OUT, help="Output JSON path.")
    parser.add_argument("--check", action="store_true", help="Print summary without writing output.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    skills = generate_skills(args.skills)

    if args.check:
        print(f"Output skills: {len(skills)}")
        for item in skills[:10]:
            print(json.dumps(item, ensure_ascii=False))
        return 0

    out_path = resolve_path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(skills, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(skills)} skills to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
