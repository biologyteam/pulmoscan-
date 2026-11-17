// Electronic Nose page: connection state and live readings from the ESP32, via the backend. Nothing is simulated.
(function () {
  var $ = function (id) { return document.getElementById(id); }, C = PS.colors, charts = {};
  var GAS = [["mq135", "MQ-135", C.maroon], ["mq7", "MQ-7", C.slate], ["mq2", "MQ-2", C.rose]];
  var ENV = [["temperature", "Temperature (\u00b0C)", C.maroon, "y"], ["humidity", "Humidity (%)", C.slate, "y1"]];

  $("howto").textContent = "POST " + location.origin + "/api/sensors/reading\nContent-Type: application/json\n\n" +
    '{"mq135": 320, "mq7": 250, "mq2": 180, "temperature": 25.0, "humidity": 48}';

  function chart(holderId, canvasId, spec, labels, readings, dual) {
    var holder = $(holderId), sets = [];
    spec.forEach(function (s) {
      var data = readings.map(function (r) { return r[s[0]]; });
      if (data.some(function (v) { return v != null; })) sets.push({ label: s[1], data: data, borderColor: s[2], backgroundColor: s[2], tension: .25, pointRadius: 0, borderWidth: 2, yAxisID: s[3] || "y", spanGaps: false });
    });
    if (!sets.length) {
      if (charts[canvasId]) { charts[canvasId].destroy(); delete charts[canvasId]; }
      holder.innerHTML = '<div class="empty">No readings received yet. This chart shows only data sent by the hardware.</div>'; return;
    }
    if (!$(canvasId)) { holder.innerHTML = '<canvas id="' + canvasId + '"></canvas>'; }
    if (!PS.chartsReady()) { holder.innerHTML = '<div class="empty">Chart library not found (js/vendor/chart.umd.js).</div>'; return; }
    var ch = charts[canvasId];
    if (ch && ch.data.datasets.length === sets.length) { ch.data.labels = labels; ch.data.datasets.forEach(function (d, i) { d.data = sets[i].data; }); ch.update("none"); return; }
    if (ch) ch.destroy();
    var scales = { x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } }, y: { title: { display: true, text: dual ? "Temperature (\u00b0C)" : "Raw sensor value" } } };
    if (dual) scales.y1 = { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Humidity (%)" } };
    charts[canvasId] = new Chart($(canvasId), { type: "line", data: { labels: labels, datasets: sets },
      options: { maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false }, scales: scales, plugins: { legend: { position: "bottom" } } } });
  }

  function render(st, hist) {
    $("connChip").innerHTML = PS.connChip(st.state, st.label);
    $("connDetail").textContent = st.detail;
    $("last").textContent = st.last_reading_at ? new Date(st.last_reading_at).toLocaleTimeString() + " (" + PS.ago(st.last_reading_at) + ")" : "\u2014";
    $("count").textContent = st.readings_received;
    $("rej").textContent = st.rejected_posts + (st.last_error ? " (last: " + st.last_error + ")" : "");
    $("thR").textContent = st.thresholds.receiving_s; $("thC").textContent = st.thresholds.connected_s;
    var last = hist.length ? hist[hist.length - 1] : null;
    $("tiles").innerHTML = PS.sensorDefs.map(function (d) {
      var on = st.sensors_reporting[d.key] && last && last[d.key] != null;
      return '<div class="tile' + (on ? "" : " off") + '"><small>' + PS.esc(d.name) + "</small><b>" + (on ? PS.esc(PS.fmtSensor(d, last[d.key])) : "Not reporting") + "</b></div>";
    }).join("");
    var labels = hist.map(function (r) { return new Date(r.time).toLocaleTimeString(); });
    chart("gasHolder", "gasChart", GAS, labels, hist, false);
    chart("envHolder", "envChart", ENV, labels, hist, true);
  }

  function poll() {
    if (document.hidden) return;
    Promise.all([PS.api("/sensors/status"), PS.api("/sensors/history?limit=60")]).then(function (r) { render(r[0], r[1].readings); }).catch(function (e) {
      $("connChip").innerHTML = PS.connChip("error", "Error"); $("connDetail").textContent = "Cannot reach the server: " + e.message;
    });
  }
  poll(); setInterval(poll, 2000);

  PS.api("/enose/status").then(function (st) {
    $("enoseChip").innerHTML = PS.research.chip(st.state, st.label);
    $("enoseText").textContent = st.state === "awaiting_dataset" ? "No gas-analysis model exists yet. It will be trained once our own labelled sensor dataset has been collected."
      : st.usable_for_prediction ? "A validated model is installed. Predictions are available through the API for research use."
      : "A model package was found but has not passed validation, so no result is shown.";
    $("enoseGates").innerHTML = st.state === "awaiting_dataset" ? "" : PS.research.gates(st.validation);
  }).catch(function () { $("enoseText").textContent = "Model status is unavailable."; });
})();
