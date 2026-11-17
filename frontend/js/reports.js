PS.ready.then(function (u) {
  if (!u) return;
  var root = document.getElementById("root"), id = new URLSearchParams(location.search).get("id");
  if (!id) return list();
  PS.api("/sessions/" + encodeURIComponent(id) + "/report").then(doc).catch(function (e) { root.innerHTML = '<div class="msg err show">' + PS.esc(e.message) + "</div>"; });

  function list() {
    PS.api("/sessions").then(function (j) {
      var rows = j.sessions.slice().reverse().map(function (s) {
        return "<tr><td>" + PS.fmtDate(s.created_at) + '</td><td class="num">' + PS.pct(s.wheeze_score) + '</td><td class="num">' + PS.pct(s.crackle_score) + '</td><td><a href="reports.html?id=' + s.session_id + '">Open report</a></td></tr>';
      }).join("");
      root.innerHTML = '<div class="panel"><h2>Your reports</h2>' + (rows ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>Session</th><th>Wheeze score</th><th>Crackle score</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>"
        : '<div class="empty" style="height:120px">No sessions yet. <a href="breathing-analysis.html">&nbsp;Analyze a recording</a></div>') + "</div>";
    }).catch(function (e) { root.innerHTML = '<div class="msg err show">' + PS.esc(e.message) + "</div>"; });
  }

  function doc(d) {
    var s = d.session, p = d.previous, ev = d.model_evaluation;
    function delta(a, b) { var x = Math.round((a - b) * 100); return (x > 0 ? "+" : "") + x + " points"; }
    var cmp = p ? '<table class="tbl"><thead><tr><th>Measure</th><th>Previous (' + PS.fmtDay(p.created_at) + ')</th><th>This session</th><th>Change</th></tr></thead><tbody>' +
      "<tr><td>Wheeze model score</td><td>" + PS.pct(p.wheeze_score) + "</td><td>" + PS.pct(s.wheeze_score) + "</td><td>" + delta(s.wheeze_score, p.wheeze_score) + "</td></tr>" +
      "<tr><td>Crackle model score</td><td>" + PS.pct(p.crackle_score) + "</td><td>" + PS.pct(s.crackle_score) + "</td><td>" + delta(s.crackle_score, p.crackle_score) + "</td></tr></tbody></table>" +
      '<p class="small muted">Differences between recordings can come from the recording position, device, background noise and breathing effort as well as from the person. Treat small changes as noise.</p>'
      : "<p>No earlier session is stored for this account, so there is nothing to compare with.</p>";
    var evrows = ev ? ["wheeze", "crackle"].map(function (k) { var m = ev[k];
      return "<tr><td>" + k[0].toUpperCase() + k.slice(1) + '</td><td class="num">' + m.auc.toFixed(2) + '</td><td class="num">' + m.balanced_accuracy.toFixed(2) + '</td><td class="num">' + m.recall.toFixed(2) + '</td><td class="num">' + m.specificity.toFixed(2) + '</td><td class="num">' + m.precision.toFixed(2) + '</td><td class="num">' + m.test_cycles + "</td></tr>"; }).join("") : "";
    root.innerHTML =
      '<div class="actions tight noprint"><button class="btn primary" id="print" type="button">Print / Save as PDF</button><a class="btn ghost" href="results.html?id=' + s.session_id + '">Back to result</a><a class="btn ghost" href="reports.html">All reports</a></div>' +
      '<article class="report" id="report">' +
      '<div class="rhead"><div><h1>Respiratory Analysis Report</h1><p class="muted">E-Nose PulmoScan &middot; research prototype</p></div><img src="../assets/lungs.png" alt=""></div>' +
      '<div class="metaGrid"><div><small>User ID</small>' + PS.esc(d.user.id) + "</div><div><small>Session date and time</small>" + PS.fmtDate(s.created_at) + "</div><div><small>Session number</small>" + d.session_number + " (of " + d.total_sessions + " saved)</div><div><small>Recording</small>" + PS.esc(s.filename) + "</div></div>" +
      '<div class="disc"><b>Research prototype.</b> This report is not a medical diagnosis and the system has not been clinically validated. It describes acoustic patterns found by a machine-learning model in one recording.</div>' +
      "<h2>1. Audio analysis result</h2>" +
      '<table class="tbl"><thead><tr><th>Model</th><th>Score</th><th>Threshold</th><th>Output</th></tr></thead><tbody>' +
      "<tr><td>Wheeze model</td><td>" + PS.pct(s.wheeze_score) + "</td><td>" + PS.pct(s.wheeze_threshold) + "</td><td>" + (s.wheeze_detected ? "Wheeze-like pattern detected" : "No wheeze-like pattern detected") + "</td></tr>" +
      "<tr><td>Crackle model</td><td>" + PS.pct(s.crackle_score) + "</td><td>" + PS.pct(s.crackle_threshold) + "</td><td>" + (s.crackle_detected ? "Crackle-like pattern detected" : "No crackle-like pattern detected") + "</td></tr></tbody></table>" +
      '<p class="small muted">Overall model confidence (distance from the decision threshold, averaged over both models): ' + PS.pct(s.confidence) + ". Recording length analyzed: " + s.duration_s + " s in " + s.windows + " window(s)" + (s.truncated ? "; only the first 30 s were analyzed" : "") + ".</p>" +
      '<div class="chartbox mt"><canvas id="rc" aria-label="Bar chart of model scores against thresholds"></canvas></div>' +
      '<div class="gauges mt">' + PS.gauge(s.wheeze_score, "Wheeze model", "threshold " + PS.pct(s.wheeze_threshold), s.wheeze_threshold, s.wheeze_detected) + PS.gauge(s.crackle_score, "Crackle model", "threshold " + PS.pct(s.crackle_threshold), s.crackle_threshold, s.crackle_detected) + "</div>" +
      "<h2>2. Gas sensors, temperature and humidity</h2><p>No electronic-nose, temperature or humidity measurements are stored for this session. Gas readings are not part of this report and are never combined with the audio result.</p>" +
      "<h2>3. Comparison with the previous session</h2>" + cmp +
      "<h2>4. Technical explanation</h2>" +
      "<p>The recording is converted to mono, resampled to 4 kHz and cut into 3-second windows. For each window, 65 acoustic features are computed (band energies from 0 to 2 kHz, spectral shape, tonality and transient measures) using the same function as in training. Two random-forest classifiers, one for wheezes and one for crackles, each return the share of trees voting for the pattern; the report shows the mean over windows. A pattern is flagged when that score reaches a decision threshold chosen on validation data, which is why a score below 50% can still be flagged.</p>" +
      "<p>The models were trained on labelled breathing cycles from the ICBHI respiratory sound database. That database labels wheezes and crackles, not asthma, so this report cannot say whether a person has asthma.</p>" +
      (ev ? '<p><b>Held-out test performance (from the training run, split by patient):</b></p><div class="tblwrap"><table class="tbl"><thead><tr><th>Model</th><th>AUC</th><th>Balanced accuracy</th><th>Sensitivity</th><th>Specificity</th><th>Precision</th><th>Test cycles</th></tr></thead><tbody>' + evrows + '</tbody></table></div><p class="small muted">An AUC near 0.5 is chance level. These models are weak and are suitable for research exploration only.</p>' : "<p>Model evaluation results were not found on the server.</p>") +
      "<h2>5. Limitations and disclaimer</h2><ul><li>Educational research prototype; not a clinically validated diagnostic device.</li><li>Results depend on recording quality, stethoscope placement and noise.</li><li>Model scores are not probabilities that a person has or does not have a disease.</li><li>Do not make medical decisions from this report. Consult a qualified clinician.</li></ul>" +
      '<p class="small muted mt">Generated ' + PS.fmtDate(new Date().toISOString()) + " from stored data for user " + PS.esc(d.user.id) + ".</p></article>";
    document.getElementById("print").onclick = function () { window.print(); };
    if (window.Chart) {
      var C = PS.colors;
      new Chart(document.getElementById("rc"), { type: "bar", data: { labels: ["Wheeze model", "Crackle model"], datasets: [
        { label: "Model score (%)", data: [s.wheeze_score * 100, s.crackle_score * 100], backgroundColor: C.maroon },
        { label: "Decision threshold (%)", data: [s.wheeze_threshold * 100, s.crackle_threshold * 100], backgroundColor: C.rose }] },
        options: { maintainAspectRatio: false, animation: false, scales: { y: { min: 0, max: 100 }, x: { grid: { display: false } } }, plugins: { legend: { position: "bottom" } } } });
    }
  }
});
