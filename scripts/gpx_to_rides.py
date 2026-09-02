#!/usr/bin/env python3
"""Convert raw GPX ride files into _data/rides.json for the 11ty cycling page.

Usage:
    python scripts/gpx_to_rides.py --gpx-dir GPX_OUT --out _data/rides.json

Parsing/metrics live in gpxlib.py (shared with everystreet.py). The trace is
simplified for inline SVG route icons; full-resolution coords are not written.
"""

import argparse
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from gpxlib import ride_from_file

LOCAL_TZ = ZoneInfo("America/Regina")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--gpx-dir", type=Path, default=Path("GPX_OUT"))
    ap.add_argument("--out", type=Path, default=Path("_data/rides.json"))
    args = ap.parse_args()

    rides = []
    for fp in sorted(args.gpx_dir.glob("*.gpx")):
        try:
            ride = ride_from_file(fp)
        except Exception as e:
            print(f"  skipping {fp.name}: {e}")
            continue
        if ride:
            ride.pop("coords", None)
            rides.append(ride)

    rides.sort(key=lambda r: r["date"] or "", reverse=True)
    payload = {
        "generated": datetime.now(LOCAL_TZ).strftime("%Y-%m-%d %H:%M"),
        "rides": rides,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {len(rides)} rides -> {args.out}")


if __name__ == "__main__":
    main()