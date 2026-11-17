PS.ready.then(function (u) {
  if (!u) return;
  var root = document.getElementById("root"), id = new URLSearchParams(location.search).get("id");
  PS.api(id ? "/sessions/" + encodeURIComponent(id) : "/sessions/latest").then(function (j) {
    var s = j.session;
    if (!s) { root.innerHTML = '<div class="panel"><div class="empty" style="height:140px">No measurements yet. <a href="breathing-analysis.html">&nbsp;Analyze a recording</a></div></div>'; return; }
    root.innerHTML = '<div class="panel"><h2>Audio model <span class="badge">Research prototype</span></h2>' +
      '<dl class="kv"><dt>Measurement date</dt><dd>' + PS.fmtDate(s.created_at) + "</dd><dt>Recording</dt><dd>" + PS.esc(s.filename) + " (" + s.duration_s + " s" + (s.truncated ? ", first 30 s analyzed" : "") + ")</dd>" +
      "<dt>Model</dt><dd>Random forest on 65 acoustic features, trained on the ICBHI stethoscope dataset (wheeze and crackle models)</dd></dl>" +
      '<div class="mt">' + PS.audioView(s) + "</div>" + PS.disclaimer + "</div>" +
      '<div class="actions tight noprint"><a class="btn primary" href="reports.html?id=' + s.session_id + '">Open report</a><a class="btn ghost" href="history.html">History</a><a class="btn ghost" href="breathing-analysis.html">New analysis</a>' +
      '<button class="btn ghost" id="del" type="button">Delete this session</button></div>';
    document.getElementById("del").onclick = function () {
      if (confirm("Delete this session permanently?")) PS.api("/sessions/" + s.session_id, { method: "DELETE" }).then(function () { location.href = "history.html"; });
    };
  }).catch(function (e) { root.innerHTML = '<div class="msg err show">' + PS.esc(e.message) + "</div>"; });
});
