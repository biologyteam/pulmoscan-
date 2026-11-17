PS.ready.then(function (u) {
  if (!u) return;
  var chart = null, from = document.getElementById("from"), to = document.getElementById("to");
  function load() {
    var q = []; if (from.value) q.push("date_from=" + from.value); if (to.value) q.push("date_to=" + to.value);
    PS.api("/sessions" + (q.length ? "?" + q.join("&") : "")).then(function (j) { draw(j.sessions); })
      .catch(function (e) { document.getElementById("list").innerHTML = '<div class="msg err show">' + PS.esc(e.message) + "</div>"; });
  }
  function draw(all) {
    var holder = document.getElementById("chartholder");
    if (chart) { chart.destroy(); chart = null; }
    if (!all.length) {
      holder.innerHTML = '<div class="empty">No saved sessions in this range.</div>';
      document.getElementById("list").innerHTML = '<p class="muted">No saved sessions in this range.</p>'; return;
    }
    holder.innerHTML = '<canvas id="chart" aria-label="Line chart of wheeze and crackle model scores by date"></canvas>';
    if (window.Chart) {
      var C = PS.colors, labels = all.map(function (s) { return PS.fmtDate(s.created_at); });
      function flat(v) { return all.map(function () { return v * 100; }); }
      chart = new Chart(document.getElementById("chart"), { type: "line", data: { labels: labels, datasets: [
        { label: "Wheeze score", data: all.map(function (s) { return s.wheeze_score * 100; }), borderColor: C.maroon, backgroundColor: C.maroon, tension: .25, pointRadius: 5 },
        { label: "Crackle score", data: all.map(function (s) { return s.crackle_score * 100; }), borderColor: C.slate, backgroundColor: C.slate, tension: .25, pointRadius: 5 },
        { label: "Wheeze threshold", data: flat(all[all.length - 1].wheeze_threshold), borderColor: C.maroon, borderDash: [5, 5], borderWidth: 1, pointRadius: 0 },
        { label: "Crackle threshold", data: flat(all[all.length - 1].crackle_threshold), borderColor: C.slate, borderDash: [5, 5], borderWidth: 1, pointRadius: 0 }] },
        options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, scales: { y: { min: 0, max: 100, title: { display: true, text: "Model score (%)" } }, x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } } }, plugins: { legend: { position: "bottom" } } } });
    } else holder.innerHTML = '<div class="empty">Chart library not found (js/vendor/chart.umd.js).</div>';
    var prev = null;
    var rows = all.slice().reverse().map(function (s, i, arr) {
      var older = arr[i + 1], d = function (a, b) { if (!older) return "—"; var x = Math.round((a - b) * 100); return '<span class="delta ' + (x > 0 ? "up" : x < 0 ? "dn" : "") + '">' + (x > 0 ? "+" : "") + x + " pts</span>"; };
      return "<tr><td>" + PS.fmtDate(s.created_at) + '</td><td class="num">' + PS.pct(s.wheeze_score) + " " + (s.wheeze_detected ? '<span class="chip hit">pattern</span>' : "") + '</td><td class="num">' + d(s.wheeze_score, older && older.wheeze_score) +
        '</td><td class="num">' + PS.pct(s.crackle_score) + " " + (s.crackle_detected ? '<span class="chip hit">pattern</span>' : "") + '</td><td class="num">' + d(s.crackle_score, older && older.crackle_score) +
        '</td><td><a href="results.html?id=' + s.session_id + '">Result</a> &middot; <a href="reports.html?id=' + s.session_id + '">Report</a></td></tr>';
    }).join("");
    document.getElementById("list").innerHTML = '<table class="tbl"><thead><tr><th>Date</th><th>Wheeze</th><th>vs previous</th><th>Crackle</th><th>vs previous</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>";
  }
  document.getElementById("apply").onclick = load;
  document.getElementById("reset").onclick = function () { from.value = ""; to.value = ""; load(); };
  load();
});
