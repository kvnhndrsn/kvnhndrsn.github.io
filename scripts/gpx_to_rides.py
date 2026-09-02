#!/usr/bin/env python3
"""Convert raw GPX ride files into _data/rides.json for the 11ty cycling page.

Usage:
    python scripts/gpx_to_rides.py --gpx-dir GPX_OUT --out _data/rides.json

Parses every GPX track with gpxpy, keeps the same moving-time/pause logic the
old pipeline used, and emits a small ride summary (metrics + a simplified
trace for inline SVG route icons).
"""

import argparse
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import gpxpy.gpx

LOCAL_TZ = ZoneInfo("America/Regina")
MAX_TRACE_POINTS = 200


def local_datetime(spot_time):
    """Return the ride's local start datetime (America/Regina, UTC-6, no DST)."""
    if spot_time is None:
        return None
    if spot_time.tzinfo is not None:
        return spot_time
    return spot_time.replace(tzinfo=timezone.utc).astimezone(LOCAL_TZ)


def all_points(gpx):
    return [p for t in gpx.tracks for s in t.segments for p in s.points
            if p.latitude is not None and p.longitude is not None]


def simplify(points, n=MAX_TRACE_POINTS):
    if len(points) <= n:
        return points
    step = (len(points) - 1) / (n - 1)
    return [points[int(i * step)] for i in range(n)]


M_PER_DEG = 111320.0


def elevation_gain(points, win=15, min_delta=0.25, min_dx=2.0):
    """Sum positive elevation changes on a smoothed series.

    Phone GPS elevation is extremely noisy; a moving average plus a minimum
    horizontal step between samples keeps the totals in the tens-of-metres
    range for flat city riding instead of summing pure jitter.
    """
    n = len(points)
    smooth = [None] * n
    for i in range(n):
        lo, hi = max(0, i - win // 2), min(n, i + win // 2 + 1)
        es = [p.elevation for p in points[lo:hi] if p.elevation is not None]
        if es:
            smooth[i] = sum(es) / len(es)

    gain = 0.0
    prev_elev = prev_lat = prev_lon = None
    for p, e in zip(points, smooth):
        if e is None:
            prev_elev = prev_lat = prev_lon = None
            continue
        if prev_elev is not None:
            dlat = (p.latitude - prev_lat) * M_PER_DEG
            dlon = (p.longitude - prev_lon) * M_PER_DEG * 0.64
            dx = (dlat * dlat + dlon * dlon) ** 0.5
            d = e - prev_elev
            if dx > min_dx and min_delta < d <= 100:
                gain += d
        prev_elev, prev_lat, prev_lon = e, p.latitude, p.longitude
    return gain


def ride_name(gpx, fp):
    for t in gpx.tracks:
        if t.name:
            return t.name
    parts = fp.stem.split("_", 3)
    tail = parts[-1].replace("_", " ") if len(parts) > 3 else fp.stem
    if "T" in tail or tail.lstrip("-").replace(".", "", 1).replace(" ", "").isdigit():
        return None
    return tail


def ride_from_file(fp):
    gpx = gpxpy.parse(open(fp, encoding="utf-8", errors="ignore"))
    pts = all_points(gpx)
    if len(pts) < 2:
        return None

    start = local_datetime(pts[0].time)
    distance_km = gpx.length_2d() / 1000.0
    moving_time_s = gpx.get_moving_data().moving_time
    avg_speed_kmh = (distance_km / moving_time_s * 3600.0) if moving_time_s else None

    trace = [[round(p.latitude, 6), round(p.longitude, 6)]
             for p in simplify(pts)]

    return {
        "date": start.date().isoformat() if start else None,
        "name": ride_name(gpx, fp),
        "distance_km": round(distance_km, 2),
        "moving_time_s": int(moving_time_s),
        "avg_speed_kmh": round(avg_speed_kmh, 1) if avg_speed_kmh else None,
        "elevation_gain_m": round(elevation_gain(pts), 1),
        "trace": trace,
    }


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