#!usr/bin/env python3
"""Shared GPX ride parsing for the cycling pipeline.

Used by both gpx_to_rides.py (page data) and everystreet.py (map layers)
so ride metrics are computed exactly once, in one place.
"""

from datetime import timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import gpxpy
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


def ride_from_file(fp: Path):
    """Parse one GPX file into a ride dict.

    Returns None for unusable tracks. Always includes:
      date, name, distance_km, moving_time_s, avg_speed_kmh, elevation_gain_m,
      trace (simplified [[lat, lon], ...] for inline SVG icons) and
      coords (full-resolution [[lon, lat], ...] for map geometry).
    """
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
    coords = [[p.longitude, p.latitude] for p in pts]

    return {
        "date": start.date().isoformat() if start else None,
        "name": ride_name(gpx, fp),
        "distance_km": round(distance_km, 2),
        "moving_time_s": int(moving_time_s),
        "avg_speed_kmh": round(avg_speed_kmh, 1) if avg_speed_kmh else None,
        "elevation_gain_m": round(elevation_gain(pts), 1),
        "trace": trace,
        "coords": coords,
    }