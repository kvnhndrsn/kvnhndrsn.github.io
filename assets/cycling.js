/* Cycling page — tiny vanilla JS: table sorting + year filter + heatmap clicks. */
(function () {
  var table = document.getElementById("ride-table");
  var heatmap = document.querySelector(".heatmap");
  var yearFilter = document.getElementById("year-filter");

  function initSort() {
    if (!table) return;
    table.querySelectorAll("th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.dataset.sort;
        var dir;
        if (th.classList.contains("sorted-asc")) dir = "desc";
        else if (th.classList.contains("sorted-desc")) dir = "asc";
        else dir = th.dataset.default || "asc";

        table
          .querySelectorAll("th.sortable")
          .forEach(function (h) {
            h.classList.remove("sorted-asc", "sorted-desc");
          });
        th.classList.add("sorted-" + dir);

        var rows = Array.prototype.slice.call(table.tBodies[0].rows);
        var idx = th.cellIndex;
        rows.sort(function (a, b) {
          var av = a.cells[idx].dataset.value || "";
          var bv = b.cells[idx].dataset.value || "";
          var cmp =
            key === "date"
              ? av.localeCompare(bv)
              : parseFloat(av) - parseFloat(bv);
          return dir === "desc" ? -cmp : cmp;
        });
        rows.forEach(function (r) {
          table.tBodies[0].appendChild(r);
        });
      });
    });
  }

  function initYearFilter() {
    if (!yearFilter || !table) return;
    yearFilter.addEventListener("click", function (e) {
      var btn = e.target.closest(".year-btn");
      if (!btn) return;
      yearFilter
        .querySelectorAll(".year-btn")
        .forEach(function (b) {
          b.classList.remove("active");
        });
      btn.classList.add("active");
      var year = btn.dataset.year;
      Array.prototype.forEach.call(table.tBodies[0].rows, function (r) {
        r.style.display =
          year === "Total" || r.dataset.year === year ? "" : "none";
      });
    });
  }

  function initHeatmap() {
    if (!heatmap || !table) return;
    heatmap.addEventListener("click", function (e) {
      var rect = e.target.closest("rect[data-date]");
      if (!rect || !rect.dataset.date) return;
      var date = rect.dataset.date;
      var already = heatmap.dataset.active === date;
      heatmap.dataset.active = already ? "" : date;
      Array.prototype.forEach.call(table.tBodies[0].rows, function (r) {
        r.classList.toggle("highlight", !already && r.dataset.date === date);
      });
    });
  }

  function initRowFocus() {
    if (!table) return;
    var iframe = document.querySelector(".everystreet-map iframe");
    if (!iframe) return;
    var pending = false;
    table.addEventListener("click", function (e) {
      var tr = e.target.closest("tr[data-date]");
      if (!tr) return;
      var focus = function () {
        var win = iframe.contentWindow;
        if (win && typeof win.__rideFocus === "function") {
          if (win.__rideFocus(tr.dataset.date)) {
            iframe.scrollIntoView({ behavior: "smooth", block: "start" });
            return true;
          }
        }
        return false;
      };
      if (!focus() && !pending) {
        pending = true;
        iframe.addEventListener(
          "load",
          function () {
            pending = false;
            focus();
          },
          { once: true }
        );
      }
    });
  }

  initSort();
  initYearFilter();
  initHeatmap();
  initRowFocus();
})();