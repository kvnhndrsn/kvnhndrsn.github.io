/* MapLibre GL JS map for #everystreet — ride interaction + street coverage */
(function () {
  "use strict";

  var TILES = {
    osm: {
      name: "OSM",
      tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxzoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    },
    cyclosm: {
      name: "CyclOSM",
      tiles: "https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors, <a href="https://www.cyclosm.org">CyclOSM</a>',
    },
    satellite: {
      name: "Satellite",
      tiles:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxzoom: 19,
      attribution: "Tiles &copy; Esri",
    },
  };

  var RIDE_COLORS = [
    "#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706",
    "#dc2626", "#db2777", "#9333ea", "#4f46e5", "#0d9488",
    "#16a34a", "#ca8a04", "#e11d48", "#c026d3", "#6d28d9",
  ];

  var MISSING_COLOR = "#e8442a";
  var RIDDEN_COLOR = "#0f9d58";

  var map, selectedRideIdx = null, detailPanel, legend, rideCoords = {}, allRides = [], rideLayerByIndex = {};

  function init() {
    var container = document.getElementById("map");
    if (!container) return;

    try {
      map = new maplibregl.Map({
        container: container,
        style: { version: 8, sources: {}, layers: [] },
        center: [-104.65, 50.45],
        zoom: 12,
        maxZoom: 19,
        attributionControl: true,
      });
    } catch (e) {
      return;
    }

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", function () {
      try {
        addTileLayers();
      } catch (e) {}
      try {
        loadStreetCoverage();
      } catch (e) {}
      try {
        loadRides();
      } catch (e) {}
      try {
        addLayerControl();
      } catch (e) {}
      try {
        addLegend();
      } catch (e) {}
      try {
        addDetailPanel();
      } catch (e) {}
      addKeyboardHandler();
    });

    window.selectRideByIndex = selectRideByIndex;
  }

  /* ── Tile layers ─────────────────────────────────────────── */

  function addTileLayers() {
    var keys = Object.keys(TILES);
    keys.forEach(function (key, i) {
      var t = TILES[key];
      if (map.getSource("tile-" + key)) return;
      map.addSource("tile-" + key, {
        type: "raster",
        tiles: [t.tiles],
        maxzoom: t.maxzoom,
        tileSize: 256,
        attribution: t.attribution,
      });
      map.addLayer({
        id: "tile-" + key,
        type: "raster",
        source: "tile-" + key,
        paint: { "raster-opacity": i === 0 ? 1 : 0 },
      });
    });
  }

  /* ── Street coverage layers ──────────────────────────────── */

  function loadStreetCoverage() {
    loadGeoJSON("/everystreet/data/missing-streets.geojson", function (fc) {
      map.addSource("missing-streets", { type: "geojson", data: fc });
      map.addLayer({
        id: "missing-streets",
        type: "line",
        source: "missing-streets",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": MISSING_COLOR,
          "line-width": 2.5,
          "line-opacity": 0.95,
        },
      });
    });

    loadGeoJSON("/everystreet/data/ridden-streets.geojson", function (fc) {
      map.addSource("ridden-streets", { type: "geojson", data: fc });
      map.addLayer({
        id: "ridden-streets",
        type: "line",
        source: "ridden-streets",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": RIDDEN_COLOR,
          "line-width": 2.5,
          "line-opacity": 0.9,
        },
      });
    });

    loadGeoJSON("/everystreet/data/planned-routes.geojson", function (fc) {
      if (!fc || !fc.features || !fc.features.length) return;
      map.addSource("planned-routes", { type: "geojson", data: fc });
      map.addLayer({
        id: "planned-routes",
        type: "line",
        source: "planned-routes",
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: "none",
        },
        paint: {
          "line-color": "#2563eb",
          "line-width": 3.5,
          "line-opacity": 0.95,
          "line-dasharray": [7, 9],
        },
      });
    });
  }

  /* ── Ride traces ─────────────────────────────────────────── */

  function loadRides() {
    var el = document.getElementById("rides-data");
    if (!el) return;
    var rides;
    try {
      rides = JSON.parse(el.textContent);
    } catch (e) {
      return;
    }
    if (!rides || !rides.length) return;
    allRides = rides;
    rideLayerByIndex = {};

    rides.forEach(function (ride, idx) {
      if (!ride.trace || ride.trace.length < 2) return;
      var coords = ride.trace.map(function (p) {
        return [p[1], p[0]];
      });
      var color = RIDE_COLORS[idx % RIDE_COLORS.length];
      rideCoords[idx] = coords;
      rideLayerByIndex[idx] = idx;

      map.addSource("ride-" + idx, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {
            name: ride.name || ride.date,
            date: ride.date,
            distance_km: ride.distance_km,
            moving_time_s: ride.moving_time_s,
            avg_speed_kmh: ride.avg_speed_kmh,
            elevation_gain_m: ride.elevation_gain_m,
            color: color,
            idx: idx,
          },
          geometry: { type: "LineString", coordinates: coords },
        },
      });

      map.addLayer({
        id: "ride-bg-" + idx,
        type: "line",
        source: "ride-" + idx,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": color,
          "line-width": 6,
          "line-opacity": 0,
        },
      });

      map.addLayer({
        id: "ride-" + idx,
        type: "line",
        source: "ride-" + idx,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": color,
          "line-width": 2.5,
          "line-opacity": 0.75,
        },
      });
    });

    addRideInteraction(rides);
  }

  /* ── Ride click interaction ──────────────────────────────── */

  function addRideInteraction(rides) {
    var rideLayerIds = [];
    rides.forEach(function (_, idx) {
      if (map.getLayer("ride-" + idx)) rideLayerIds.push("ride-" + idx);
    });

    map.on("click", rideLayerIds, function (e) {
      if (!e.features || !e.features.length) return;
      var f = e.features[0];
      var idx = f.properties.idx;
      if (typeof idx === "string") idx = parseInt(idx, 10);
      if (selectedRideIdx === idx) {
        deselectRide();
      } else {
        selectRide(idx, rides[idx]);
      }
    });

    map.on("mouseenter", rideLayerIds, function () {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", rideLayerIds, function () {
      map.getCanvas().style.cursor = "";
    });

    map.on("click", function (e) {
      var hit = map.queryRenderedFeatures(e.point, { layers: rideLayerIds });
      if (!hit.length) deselectRide();
    });

    map.on("click", "missing-streets", function (e) {
      if (!e.features || !e.features.length) return;
      var f = e.features[0];
      var name = f.properties.name || "(unnamed)";
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
          '<div style="font:13px/1.4 sans-serif;padding:2px 0">' +
            "<strong>" + escHtml(name) + "</strong>" +
            '<span style="color:#888;margin-left:6px">not ridden</span>' +
            "</div>"
        )
        .addTo(map);
    });

    map.on("click", "ridden-streets", function (e) {
      if (!e.features || !e.features.length) return;
      var f = e.features[0];
      var name = f.properties.name || "(unnamed)";
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
          '<div style="font:13px/1.4 sans-serif;padding:2px 0">' +
            "<strong>" + escHtml(name) + "</strong>" +
            '<span style="color:#0f9d58;margin-left:6px">ridden</span>' +
            "</div>"
        )
        .addTo(map);
    });

    map.on("mouseenter", "missing-streets", function () {
      map.getCanvas().style.cursor = "pointer";
      map.setPaintProperty("missing-streets", "line-width", 4);
    });
    map.on("mouseleave", "missing-streets", function () {
      map.getCanvas().style.cursor = "";
      map.setPaintProperty("missing-streets", "line-width", 2.5);
    });
    map.on("mouseenter", "ridden-streets", function () {
      map.getCanvas().style.cursor = "pointer";
      map.setPaintProperty("ridden-streets", "line-width", 4);
    });
    map.on("mouseleave", "ridden-streets", function () {
      map.getCanvas().style.cursor = "";
      map.setPaintProperty("ridden-streets", "line-width", 2.5);
    });
  }

  function selectRide(idx, ride) {
    deselectRide();
    selectedRideIdx = idx;

    map.setPaintProperty("ride-" + idx, "line-width", 5);
    map.setPaintProperty("ride-" + idx, "line-opacity", 1);
    map.setPaintProperty("ride-bg-" + idx, "line-opacity", 0.25);

    var coords = rideCoords[idx] || [];
    if (!coords.length) return;
    var bounds = coords.reduce(
      function (b, c) { return b.extend(c); },
      new maplibregl.LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 });

    showRideDetail(ride, idx);
  }

  function deselectRide() {
    if (selectedRideIdx === null) return;
    var idx = selectedRideIdx;
    if (map.getLayer("ride-" + idx)) {
      map.setPaintProperty("ride-" + idx, "line-width", 2.5);
      map.setPaintProperty("ride-" + idx, "line-opacity", 0.75);
      map.setPaintProperty("ride-bg-" + idx, "line-opacity", 0);
    }
    selectedRideIdx = null;
    hideRideDetail();
  }

  function showRideDetail(ride, idx) {
    if (!detailPanel) return;
    var color = RIDE_COLORS[idx % RIDE_COLORS.length];
    var dist = ride.distance_km != null ? ride.distance_km.toFixed(1) : "—";
    var elev = ride.elevation_gain_m != null ? Math.round(ride.elevation_gain_m) : "—";
    var speed = ride.avg_speed_kmh != null ? ride.avg_speed_kmh.toFixed(1) : "—";
    var time = formatTime(ride.moving_time_s);
    detailPanel.innerHTML =
      '<div class="ride-detail-header">' +
        '<span class="ride-detail-color" style="background:' + color + '"></span>' +
        '<span class="ride-detail-date">' + escHtml(ride.date || ride.name || "") + "</span>" +
        '<button class="ride-detail-close" aria-label="Close">&times;</button>' +
      "</div>" +
      '<div class="ride-detail-stats">' +
        '<div><span class="rd-label">Distance</span><span class="rd-value">' + dist + " km</span></div>" +
        '<div><span class="rd-label">Elevation</span><span class="rd-value">' + elev + " m</span></div>" +
        '<div><span class="rd-label">Avg speed</span><span class="rd-value">' + speed + " km/h</span></div>" +
        '<div><span class="rd-label">Time</span><span class="rd-value">' + time + "</span></div>" +
      "</div>";
    detailPanel.classList.add("visible");
    detailPanel.querySelector(".ride-detail-close").addEventListener("click", deselectRide);
  }

  function hideRideDetail() {
    if (detailPanel) detailPanel.classList.remove("visible");
  }

  /* ── External entry point (used by table/heatmap clicks) ── */

  function selectRideByIndex(idx, opts) {
    opts = opts || {};
    if (!map || !allRides.length) return;
    idx = parseInt(idx, 10);
    if (isNaN(idx) || !allRides[idx] || !rideCoords[idx]) return;
    selectRide(idx, allRides[idx]);
    if (opts && opts.scrollToMap) {
      var el = document.getElementById("map");
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  /* ── Layer control ───────────────────────────────────────── */

  function addLayerControl() {
    var ctrl = document.createElement("div");
    ctrl.className = "map-layer-control";

    var sections = [
      {
        title: "Base map",
        type: "radio",
        items: Object.keys(TILES).map(function (key, i) {
          return { key: key, label: TILES[key].name, checked: i === 0 };
        }),
        onChange: function (key) {
          Object.keys(TILES).forEach(function (k) {
            map.setPaintProperty("tile-" + k, "raster-opacity", k === key ? 1 : 0);
          });
        },
      },
      {
        title: "Layers",
        type: "checkbox",
        items: [
          { key: "missing-streets", label: "Missing streets", color: MISSING_COLOR, checked: true },
          { key: "ridden-streets", label: "Ridden streets", color: RIDDEN_COLOR, checked: true },
          { key: "planned-routes", label: "Planned routes", color: "#2563eb", checked: false },
        ],
        onChange: function (key, on) {
          if (map.getLayer(key)) {
            map.setLayoutProperty(key, "visibility", on ? "visible" : "none");
          }
        },
      },
    ];

    sections.forEach(function (sec) {
      var heading = document.createElement("div");
      heading.className = "lc-heading";
      heading.textContent = sec.title;
      ctrl.appendChild(heading);

      sec.items.forEach(function (item) {
        var label = document.createElement("label");
        label.className = "lc-item";
        var input = document.createElement("input");
        input.type = sec.type === "radio" ? "radio" : "checkbox";
        input.name = "lc-" + sec.title;
        if (sec.type === "radio") input.value = item.key;
        else input.value = item.key;
        input.checked = item.checked;

        input.addEventListener("change", function () {
          if (sec.type === "radio") {
            sec.onChange(item.key);
          } else {
            sec.onChange(item.key, input.checked);
          }
        });

        label.appendChild(input);
        if (item.color) {
          var swatch = document.createElement("span");
          swatch.className = "lc-swatch";
          swatch.style.background = item.color;
          label.appendChild(swatch);
        }
        label.appendChild(document.createTextNode(" " + item.label));
        ctrl.appendChild(label);
      });
    });

    map.getContainer().appendChild(ctrl);
  }

  /* ── Legend ───────────────────────────────────────────────── */

  function addLegend() {
    legend = document.createElement("div");
    legend.className = "map-legend";
    legend.innerHTML =
      '<div class="legend-title">#everystreet — Regina</div>' +
      '<div class="legend-item"><span class="legend-swatch" style="border-top:3px solid ' + MISSING_COLOR + '"></span>Missing</div>' +
      '<div class="legend-item"><span class="legend-swatch" style="border-top:3px solid ' + RIDDEN_COLOR + '"></span>Ridden</div>' +
      '<div class="legend-item"><span class="legend-swatch" style="border-top:3px dashed #2563eb"></span>Planned</div>' +
      '<div class="legend-item"><span class="legend-swatch" style="border-top:3px solid #7c3aed"></span>GPX tracks</div>';
    map.getContainer().appendChild(legend);
  }

  /* ── Detail panel ────────────────────────────────────────── */

  function addDetailPanel() {
    detailPanel = document.createElement("div");
    detailPanel.className = "ride-detail-panel";
    map.getContainer().appendChild(detailPanel);
  }

  /* ── Keyboard ────────────────────────────────────────────── */

  function addKeyboardHandler() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") deselectRide();
    });
  }

  /* ── Helpers ─────────────────────────────────────────────── */

  function loadGeoJSON(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 400) {
        try {
          cb(JSON.parse(xhr.responseText));
        } catch (e) {
          /* skip malformed */
        }
      }
    };
    xhr.onerror = function () {};
    xhr.send();
  }

  function formatTime(s) {
    if (!s || s <= 0) return "—";
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (h > 0) return h + "h " + m + "min";
    return m + "min";
  }

  function escHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
