// Model Performance page: stored held-out metrics of the wheeze and crackle models (GET /api/results -> audio_detail).
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var MET = [["ROC-AUC", "auc"], ["Balanced accuracy", "balanced_accuracy"], ["Sensitivity (recall)", "recall"], ["Specificity", "specificity"], ["Precision", "precision"], ["F1-score", "f1"], ["Accuracy", "accuracy"]];
  function pct(x) { return x == null ? "\u2014" : (x * 100).toFixed(1) + " %"; }
  function matrix(x) {
    return '<div class="matrix"><div class="h"></div><div class="h">Predicted negative</div><div class="h">Predicted positive</div><div class="h">Actual negative</div><div class="hit">' + x[0][0] + "</div><div>" + x[0][1] +
      '</div><div class="h">Actual positive</div><div>' + x[1][0] + '</div><div class="hit">' + x[1][1] + "</div></div>";
  }
  fetch("/api/results").then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (res) {
    var d = res.audio_detail || {}, w = d.wheeze, c = d.crackle;
    if (!w && !c) {
      $("rows").innerHTML = '<tr><td colspan="3" class="muted">No evaluation results found. Run training/train_audio.py to create models/results.json.</td></tr>';
      ["wheeze", "crackle"].forEach(function (k) { $("matrix-" + k).innerHTML = '<div class="empty" style="height:150px">No results yet.</div>'; });
      $("cmpChart").innerHTML = '<div class="empty">The chart appears when results exist.</div>'; return;
    }
    $("rows").innerHTML = MET.map(function (m) { return "<tr><td>" + m[0] + '</td><td class="num">' + pct(w && w[m[1]]) + '</td><td class="num">' + pct(c && c[m[1]]) + "</td></tr>"; }).join("") +
      "<tr><td>Decision threshold</td><td class=\"num\">" + (w ? w.threshold : "\u2014") + '</td><td class="num">' + (c ? c.threshold : "\u2014") + "</td></tr>" +
      "<tr><td>Test breathing cycles (positive)</td><td class=\"num\">" + (w ? w.test_cycles + " (" + w.positive_in_test + ")" : "\u2014") + '</td><td class="num">' + (c ? c.test_cycles + " (" + c.positive_in_test + ")" : "\u2014") + "</td></tr>";
    [["wheeze", w], ["crackle", c]].forEach(function (p) { $("matrix-" + p[0]).innerHTML = p[1] ? matrix(p[1].matrix) : '<div class="empty" style="height:150px">No results yet.</div>'; });
    if (!w || !c) { $("cmpChart").innerHTML = '<div class="empty">The chart appears when both models have results.</div>'; return; }
    if (!PS.chartsReady()) { $("cmpChart").innerHTML = '<div class="empty">Chart library not found (js/vendor/chart.umd.js).</div>'; return; }
    $("cmpChart").innerHTML = "<canvas></canvas>";
    var keys = ["auc", "balanced_accuracy", "recall", "specificity", "precision", "f1"];
    new Chart($("cmpChart").firstChild, { type: "bar", data: { labels: ["ROC-AUC", "Balanced accuracy", "Sensitivity", "Specificity", "Precision", "F1-score"],
      datasets: [["Wheeze model", w, PS.colors.maroon], ["Crackle model", c, PS.colors.slate]].map(function (m) { return { label: m[0], data: keys.map(function (k) { return m[1][k] * 100; }), backgroundColor: m[2] }; }) },
      options: { maintainAspectRatio: false, scales: { y: { min: 0, max: 100, title: { display: true, text: "%" } }, x: { grid: { display: false } } }, plugins: { legend: { position: "bottom" } } } });
  });
})();
