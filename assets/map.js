/* MapLibre GL JS map for #everystreet — ride interaction + street coverage */
(function () {
  "use strict";

  /* Free basemaps — no API key required.
     dark / light / bright are OpenFreeMap vector styles (community-funded).
     osm / satellite are raster tile servers. */
  var BASEMAPS = [
    {
      key: "dark",
      name: "Dark",
      vector: "https://tiles.openfreemap.org/styles/dark",
    },
    {
      key: "light",
      name: "Light",
      vector: "https://tiles.openfreemap.org/styles/positron",
    },
    {
      key: "bright",
      name: "Bright",
      vector: "https://tiles.openfreemap.org/styles/bright",
    },
    {
      key: "osm",
      name: "OSM",
      tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxzoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    },
    {
      key: "satellite",
      name: "Satellite",
      tiles:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxzoom: 19,
      attribution: "Tiles &copy; Esri",
    },
  ];
  var RIDE_COLORS = [
    "#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706",
    "#dc2626", "#db2777", "#9333ea", "#4f46e5", "#0d9488",
    "#16a34a", "#ca8a04", "#e11d48", "#c026d3", "#6d28d9",
  ];

  var MISSING_COLOR = "#e8442a";
  var RIDDEN_COLOR = "#0f9d58";
  var GPX_COLOR = "#7c3aed";
  var COMBINED_COLOR = "#22d3ee";

  /* Street layer visibility state — OFF by default. Only rendered when the
     matching layer-control checkbox is toggled on. */
  var layerVis = { "missing-streets": false, "ridden-streets": false, "gpx-routes": true, "rides-combined": false };
  var filteredYear = "all";

  var map,
    selectedRideIdx = null,
    hoverRideIdx = null,
    interactionBound = false,
    detailPanel,
    allRides = [],
    rideCoords = {},
    rideLayerByIndex = {},
    gpxToggleInput = null,
    yearSelect = null,
    maxSpeedMarker = null;

  function init() {
    var container = document.getElementById("map");
    if (!container) return;

    try {
      map = new maplibregl.Map({
        container: container,
        style: styleSpecFor(BASEMAPS[0]),
        center: [-104.65, 50.45],
        zoom: 12,
        maxZoom: 19,
        attributionControl: true,
      });
    } catch (e) {
      return;
    }

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    parseRides();

    /* Initial overlays: bind once the first style is usable. The `load`
       event fires reliably on first render; basemap changes are handled
       separately in setBasemap(). */
    map.on("load", function () {
      try { bindOverlays(); } catch (e) {}
      try { addLayerControl(); } catch (e) {}
      try { addDetailPanel(); } catch (e) {}
      addKeyboardHandler();
    });

    window.selectRideByIndex = selectRideByIndex;
    window.showAllRides = showAllRides;
  }

  function styleSpecFor(bm) {
    if (bm.vector) return bm.vector;
    /* Raster basemaps need a minimal inline style. */
    return {
      version: 8,
      sources: {
        "basemap-raster": {
          type: "raster",
          tiles: [bm.tiles],
          tileSize: 256,
          maxzoom: bm.maxzoom,
          attribution: bm.attribution,
        },
      },
      layers: [
        { id: "basemap-raster", type: "raster", source: "basemap-raster" },
      ],
    };
  }

  function setBasemap(key) {
    var bm = BASEMAPS.find(function (b) { return b.key === key; });
    if (!bm) return;
    map.setStyle(styleSpecFor(bm));
    /* setStyle() replaces the whole style but does not reliably re-fire
       `load`/`style.load`, so re-bind overlay layers once the new style is
       ready. */
    waitForStyleThen(bm, bindOverlays);
  }

  function waitForStyleThen(bm, cb) {
    /* Detect that the target style has actually loaded by polling for its
       distinctive source (openmaptiles for vector basemaps, basemap-raster
       for raster basemaps). Source presence is set as soon as the style JSON
       loads, independent of whether the tiles themselves download. */
    var sentinel = bm.vector ? "openmaptiles" : "basemap-raster";
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var style = map.getStyle();
      if (style && style.sources && style.sources[sentinel]) {
        clearInterval(timer);
        try { cb(); } catch (e) {}
      } else if (tries > 400) {
        /* ~20s safety timeout */
        clearInterval(timer);
      }
    }, 50);
  }

  /* ── Overlays: streets + rides ───────────────────────────── */

  function bindOverlays() {
    bindStreetLayers();
    bindRideLayers();
    /* Restore the selected ride's emphasis after a style swap. */
    if (selectedRideIdx !== null && rideCoords[selectedRideIdx]) {
      var idx = selectedRideIdx;
      Object.keys(rideLayerByIndex).forEach(function (other) {
        if (parseInt(other, 10) === idx) return;
        if (map.getLayer("ride-" + other)) {
          map.setPaintProperty("ride-" + other, "line-opacity", 0.12);
          map.setPaintProperty("ride-" + other, "line-width", 1.2);
        }
      });
      if (map.getLayer("ride-" + idx)) {
        map.setPaintProperty("ride-" + idx, "line-width", 3.2);
        map.setPaintProperty("ride-" + idx, "line-opacity", 1);
      }
      if (map.getLayer("ride-bg-" + idx)) {
        map.setPaintProperty("ride-bg-" + idx, "line-opacity", 0.3);
      }
    }
  }

  function bindStreetLayers() {
    addStreetLayer("missing-streets",
      "/everystreet/data/missing-streets.geojson", MISSING_COLOR, 2.2,
      { visibility: layerVis["missing-streets"] ? "visible" : "none" });
    addStreetLayer("ridden-streets",
      "/everystreet/data/ridden-streets.geojson", RIDDEN_COLOR, 2.2,
      { visibility: layerVis["ridden-streets"] ? "visible" : "none" });
    /* Everything you've ridden, merged into one overlay. */
    addStreetLayer("rides-combined",
      "/everystreet/data/rides-combined.geojson", COMBINED_COLOR, 1.2,
      { visibility: layerVis["rides-combined"] ? "visible" : "none", opacity: 0.75 });
  }

  /* Show/hide every GPX ride layer, honouring both the "My GPX routes"
     toggle and the year dropdown in the layer control. */
  function applyRideVisibility() {
    Object.keys(rideLayerByIndex).forEach(function (k) {
      var ride = allRides[parseInt(k, 10)];
      var inYear = filteredYear === "all" || (ride && ride.date &&
        ride.date.slice(0, 4) === filteredYear);
      var show = layerVis["gpx-routes"] && inYear;
      ["ride-" + k, "ride-bg-" + k].forEach(function (id) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", show ? "visible" : "none");
        }
      });
    });
  }

  /* Make sure a ride we're asked to focus on can actually be seen: turn on
     the GPX layer and drop any year filter that would hide it. */
  function ensureRideVisible(ride) {
    if (!layerVis["gpx-routes"]) {
      layerVis["gpx-routes"] = true;
      if (gpxToggleInput) gpxToggleInput.checked = true;
      applyRideVisibility();
    }
    var y = ride && ride.date ? ride.date.slice(0, 4) : null;
    if (y && filteredYear !== "all" && filteredYear !== y) {
      filteredYear = y;
      if (yearSelect) yearSelect.value = y;
      applyRideVisibility();
    }
  }

  function allYears() {
    var years = {};
    allRides.forEach(function (r) {
      if (r && r.date) years[r.date.slice(0, 4)] = true;
    });
    return Object.keys(years).sort().reverse();
  }

  function addStreetLayer(id, url, color, width, opts) {
    opts = opts || {};
    if (map.getSource(id)) return;
    map.addSource(id, { type: "geojson", data: url });
    map.addLayer({
      id: id,
      type: "line",
      source: id,
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: opts.visibility || "visible",
      },
      paint: {
        "line-color": color,
        "line-width": width,
        "line-opacity": opts.opacity != null ? opts.opacity : 0.95,
        ...(opts.dash ? { "line-dasharray": opts.dash } : {}),
      },
    });
  }

  function parseRides() {
    var el = document.getElementById("rides-data");
    if (!el) return;
    try {
      var rides = JSON.parse(el.textContent);
    } catch (e) {
      return;
    }
    if (!rides || !rides.length) return;
    allRides = rides;
  }

  function bindRideLayers() {
    rideLayerByIndex = {};
    rideCoords = {};

    allRides.forEach(function (ride, idx) {
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
          "line-width": 4,
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
          "line-width": 1.6,
          "line-opacity": 0.75,
        },
      });
    });

    addRideInteraction();
    applyRideVisibility();
  }

  /* ── Ride click interaction ──────────────────────────────── */

  function addRideInteraction() {
    if (interactionBound) return;
    interactionBound = true;

    var rideLayerIds = [];
    Object.keys(rideLayerByIndex).forEach(function (k) {
      if (map.getLayer("ride-" + k)) rideLayerIds.push("ride-" + k);
    });

    map.on("click", rideLayerIds, function (e) {
      if (!e.features || !e.features.length) return;
      var f = e.features[0];
      var idx = f.properties.idx;
      if (typeof idx === "string") idx = parseInt(idx, 10);
      if (selectedRideIdx === idx) {
        deselectRide();
      } else {
        selectRide(idx, allRides[idx]);
      }
    });

    /* Hover: emphasise the ride under the cursor and show a pointer so it is
       obvious the trace can be clicked. Skipped while a single ride is
       selected — only meaningful in "all rides" mode. */
    map.on("mouseenter", rideLayerIds, function (e) {
      if (selectedRideIdx !== null) return;
      if (!e.features || !e.features.length) return;
      var k = e.features[0].properties.idx;
      if (typeof k === "string") k = parseInt(k, 10);
      hoverRideIdx = k;
      map.getCanvas().style.cursor = "pointer";
      if (map.getLayer("ride-" + k)) {
        map.setPaintProperty("ride-" + k, "line-width", 5);
        map.setPaintProperty("ride-" + k, "line-opacity", 1);
      }
      if (map.getLayer("ride-bg-" + k)) {
        map.setPaintProperty("ride-bg-" + k, "line-opacity", 0.5);
      }
    });
    map.on("mouseleave", rideLayerIds, function () {
      map.getCanvas().style.cursor = "";
      if (hoverRideIdx !== null) {
        paintRideIdle(hoverRideIdx);
        hoverRideIdx = null;
      }
    });

    map.on("click", function (e) {
      var hit = map.queryRenderedFeatures(e.point, { layers: rideLayerIds });
      if (!hit.length) deselectRide();
    });

    map.on("click", "missing-streets", function (e) {
      if (!e.features || !e.features.length) return;
      var name = e.features[0].properties.name || "(unnamed)";
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
      var name = e.features[0].properties.name || "(unnamed)";
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
      map.setPaintProperty("missing-streets", "line-width", 2.2);
    });
    map.on("mouseenter", "ridden-streets", function () {
      map.getCanvas().style.cursor = "pointer";
      map.setPaintProperty("ridden-streets", "line-width", 4);
    });
    map.on("mouseleave", "ridden-streets", function () {
      map.getCanvas().style.cursor = "";
      map.setPaintProperty("ridden-streets", "line-width", 2.2);
    });
  }

  /* Set a ride's line back to its idle or selected emphasis. */
  function paintRideIdle(idx) {
    var selected = idx === selectedRideIdx;
    if (map.getLayer("ride-" + idx)) {
      map.setPaintProperty("ride-" + idx, "line-width", selected ? 3.2 : 1.6);
      map.setPaintProperty("ride-" + idx, "line-opacity", selected ? 1 : 0.75);
    }
    if (map.getLayer("ride-bg-" + idx)) {
      map.setPaintProperty("ride-bg-" + idx, "line-opacity", selected ? 0.3 : 0);
    }
  }

  function selectRide(idx, ride) {
    deselectRide();
    selectedRideIdx = idx;

    /* Dim/hide every other ride so the selected one stands out. */
    Object.keys(rideLayerByIndex).forEach(function (other) {
      if (parseInt(other, 10) === idx) return;
      if (map.getLayer("ride-" + other)) {
        map.setPaintProperty("ride-" + other, "line-opacity", 0.12);
        map.setPaintProperty("ride-" + other, "line-width", 1.2);
      }
      if (map.getLayer("ride-bg-" + other)) {
        map.setPaintProperty("ride-bg-" + other, "line-opacity", 0);
      }
    });

    if (map.getLayer("ride-" + idx)) {
      map.setPaintProperty("ride-" + idx, "line-width", 3.2);
      map.setPaintProperty("ride-" + idx, "line-opacity", 1);
    }
    if (map.getLayer("ride-bg-" + idx)) {
      map.setPaintProperty("ride-bg-" + idx, "line-opacity", 0.3);
    }

    var coords = rideCoords[idx] || [];
    if (!coords.length) return;
    var bounds = coords.reduce(
      function (b, c) { return b.extend(c); },
      new maplibregl.LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 });

    showRideDetail(ride, idx);
    showMaxSpeedMarker(ride);
  }

  function deselectRide() {
    if (selectedRideIdx === null) return;
    var idx = selectedRideIdx;
    if (map.getLayer("ride-" + idx)) {
      map.setPaintProperty("ride-" + idx, "line-width", 1.6);
      map.setPaintProperty("ride-" + idx, "line-opacity", 0.75);
    }
    if (map.getLayer("ride-bg-" + idx)) {
      map.setPaintProperty("ride-bg-" + idx, "line-opacity", 0);
    }
    selectedRideIdx = null;
    hideRideDetail();
    clearMaxSpeedMarker();
    showAllRides();
  }

  function showAllRides() {
    Object.keys(rideLayerByIndex).forEach(function (k) {
      if (map.getLayer("ride-" + k)) {
        map.setPaintProperty("ride-" + k, "line-width", 1.6);
        map.setPaintProperty("ride-" + k, "line-opacity", 0.75);
      }
      if (map.getLayer("ride-bg-" + k)) {
        map.setPaintProperty("ride-bg-" + k, "line-opacity", 0);
      }
    });
  }

  function showRideDetail(ride, idx) {
    if (!detailPanel) return;
    var color = RIDE_COLORS[idx % RIDE_COLORS.length];
    var dist = ride.distance_km != null ? ride.distance_km.toFixed(1) : "—";
    var elev = ride.elevation_gain_m != null ? Math.round(ride.elevation_gain_m) : "—";
    var speed = ride.avg_speed_kmh != null ? ride.avg_speed_kmh.toFixed(1) : "—";
    var maxSpeed = ride.max_speed_kmh != null ? ride.max_speed_kmh.toFixed(1) : "—";
    var time = formatTime(ride.moving_time_s);
    detailPanel.innerHTML =
      '<div class="ride-detail-header">' +
        '<span class="ride-detail-color" style="background:' + color + '"></span>' +
        '<span class="ride-detail-date">' + escHtml(ride.date || ride.name || "") + "</span>" +
        '<button class="ride-detail-close" aria-label="Close">&times;</button>' +
      "</div>" +
      '<div class="ride-detail-stats">' +
        '<div><span class="rd-label">Distance</span><span class="rd-value">' + dist + " km</span></div>" +
        '<div><span class="rd-label">Elev gain</span><span class="rd-value">' + elev + " m</span></div>" +
        '<div><span class="rd-label">Avg speed</span><span class="rd-value">' + speed + " km/h</span></div>" +
        '<div><span class="rd-label">Time</span><span class="rd-value">' + time + "</span></div>" +
        '<div><span class="rd-label">Max speed</span><span class="rd-value">' + maxSpeed + " km/h</span></div>" +
      "</div>" +
      '<button class="ride-detail-showall" type="button">Show all rides</button>';
    detailPanel.classList.add("visible");
    detailPanel.querySelector(".ride-detail-close").addEventListener("click", deselectRide);
    detailPanel.querySelector(".ride-detail-showall").addEventListener("click", deselectRide);
  }

  function hideRideDetail() {
    if (detailPanel) detailPanel.classList.remove("visible");
  }

  /* ── Top-speed marker ────────────────────────────────────── */

  function showMaxSpeedMarker(ride) {
    clearMaxSpeedMarker();
    if (!ride || ride.max_speed_kmh == null ||
        !ride.max_speed_point || ride.max_speed_point.length < 2) return;
    var el = document.createElement("div");
    el.className = "ride-maxspeed-marker";
    el.title = "Top speed: " + ride.max_speed_kmh.toFixed(1) + " km/h";
    var popup = new maplibregl.Popup({ closeButton: false, offset: [0, -16], className: "ride-maxspeed-popup" })
      .setHTML(
        '<div style="font:13px/1.4 sans-serif;padding:2px 8px">' +
          '<strong>' + ride.max_speed_kmh.toFixed(1) + " km/h</strong>" +
          '<span style="color:#555"> top speed</span>' +
        "</div>"
      );
    maxSpeedMarker = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([ride.max_speed_point[1], ride.max_speed_point[0]])
      .setPopup(popup)
      .addTo(map);
    popup.addTo(map);
  }

  function clearMaxSpeedMarker() {
    if (maxSpeedMarker) maxSpeedMarker.remove();
    maxSpeedMarker = null;
  }

  /* ── External entry point (used by table/heatmap clicks) ── */

  function selectRideByIndex(idx, opts) {
    opts = opts || {};
    if (!map || !allRides.length) return;
    idx = parseInt(idx, 10);
    if (isNaN(idx) || !allRides[idx] || !rideCoords[idx]) return;
    var ride = allRides[idx];
    ensureRideVisible(ride);
    selectRide(idx, ride);
    if (opts && opts.scrollToMap) {
      var el = document.getElementById("map");
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  /* ── Layer control ───────────────────────────────────────── */

  function addLayerControl() {
    var ctrl = document.createElement("div");
    ctrl.className = "map-layer-control";

    /* Base map dropdown */
    var baseHeading = document.createElement("div");
    baseHeading.className = "lc-heading";
    baseHeading.textContent = "Base map";
    ctrl.appendChild(baseHeading);

    var select = document.createElement("select");
    select.className = "lc-select";
    select.addEventListener("change", function () {
      setBasemap(select.value);
    });
    BASEMAPS.forEach(function (b, i) {
      var option = document.createElement("option");
      option.value = b.key;
      option.textContent = b.name;
      if (i === 0) option.selected = true;
      select.appendChild(option);
    });
    ctrl.appendChild(select);

    /* Layer toggles */
    var layersHeading = document.createElement("div");
    layersHeading.className = "lc-heading";
    layersHeading.textContent = "Layers";
    ctrl.appendChild(layersHeading);

    [
      { key: "missing-streets", label: "Missing streets", color: MISSING_COLOR },
      { key: "ridden-streets", label: "Ridden streets", color: RIDDEN_COLOR },
      { key: "gpx-routes", label: "My GPX routes", color: GPX_COLOR },
      { key: "rides-combined", label: "Combined routes", color: COMBINED_COLOR },
    ].forEach(function (item) {
      var label = document.createElement("label");
      label.className = "lc-item";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.value = item.key;
      input.checked = layerVis[item.key];
      if (item.key === "gpx-routes") gpxToggleInput = input;

      input.addEventListener("change", function () {
        layerVis[item.key] = input.checked;
        if (item.key === "gpx-routes") {
          applyRideVisibility();
        } else if (map.getLayer(item.key)) {
          map.setLayoutProperty(item.key, "visibility", input.checked ? "visible" : "none");
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

    /* Year dropdown — shows only rides from the chosen year on the map. */
    var yearHeading = document.createElement("div");
    yearHeading.className = "lc-heading";
    yearHeading.textContent = "Year";
    ctrl.appendChild(yearHeading);

    yearSelect = document.createElement("select");
    yearSelect.className = "lc-select";
    var years = allYears();
    var anyOption = document.createElement("option");
    anyOption.value = "all";
    anyOption.textContent = "All years";
    anyOption.selected = true;
    yearSelect.appendChild(anyOption);
    years.forEach(function (y) {
      var option = document.createElement("option");
      option.value = y;
      option.textContent = y;
      yearSelect.appendChild(option);
    });
    yearSelect.addEventListener("change", function () {
      filteredYear = yearSelect.value;
      applyRideVisibility();
      /* A selected ride from another year would be hidden — drop it. */
      if (selectedRideIdx !== null) {
        var ride = allRides[selectedRideIdx];
        var ry = ride && ride.date ? ride.date.slice(0, 4) : null;
        if (filteredYear !== "all" && ry !== filteredYear) deselectRide();
      }
    });
    ctrl.appendChild(yearSelect);

    map.getContainer().appendChild(ctrl);
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
