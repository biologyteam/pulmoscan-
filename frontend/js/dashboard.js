// Dashboard: prototype connection status, latest audio analysis, latest sensor measurements. Real data only.
PS.ready.then(function (u) {
  if (!u) return;
  var $ = function (id) { return document.getElementById(id); };
  var sensor = null, audio = null, lastSession = null;     // latest known state, combined into the hardware summary

  function hardware() {
    var noseOk = sensor && (sensor.state === "receiving_data" || sensor.state === "connected"), audioOk = audio && audio.state === "available";
    var st, label, text;
    if (sensor && sensor.state === "error") { st = "error"; label = "Error"; text = "The electronic nose sent data that was rejected. See the Electronic Nose page."; }
    else if (noseOk && audioOk) { st = "connected"; label = "Connected"; text = "Audio input and electronic nose are both available."; }
    else if (noseOk || audioOk) { st = "partial"; label = "Partly connected"; text = noseOk ? "Electronic nose is connected; no audio input detected." : "Audio input detected; electronic nose is not sending data."; }
    else { st = "disconnected"; label = "Disconnected"; text = "No audio input detected and no data from the electronic nose."; }
    $("hwChip").innerHTML = PS.connChip(st, label); $("hwText").textContent = text;
  }

  function showSensor(stt, last) {
    sensor = stt;
    $("enChip").innerHTML = PS.connChip(stt.state, stt.label); $("snChip").innerHTML = PS.connChip(stt.state, stt.label);
    $("enText").textContent = stt.detail;
    $("rxNose").textContent = stt.last_reading_at ? new Date(stt.last_reading_at).toLocaleTimeString() : "None yet";
    $("snNote").textContent = stt.last_reading_at ? "Last received " + new Date(stt.last_reading_at).toLocaleString() + " (" + PS.ago(stt.last_reading_at) + "). Live values from the electronic nose; not yet saved to your profile."
      : "No reading has been received from the electronic nose yet, so no values are shown.";
    $("tiles").innerHTML = PS.sensorDefs.map(function (d) {
      var on = stt.sensors_reporting[d.key] && last && last[d.key] != null;
      return '<div class="tile' + (on ? "" : " off") + '"><small>' + PS.esc(d.name) + "</small><b>" + (on ? PS.esc(PS.fmtSensor(d, last[d.key])) : "Not reporting") + "</b></div>";
    }).join("");
    hardware();
  }
  function pollSensor() {
    if (document.hidden) return;
    Promise.all([PS.api("/sensors/status"), PS.api("/sensors/latest")]).then(function (r) { showSensor(r[0], r[1].reading); }).catch(function (e) {
      showSensor({ state: "error", label: "Error", detail: "Cannot reach the server: " + e.message, last_reading_at: null, sensors_reporting: {} }, null);
    });
  }
  pollSensor(); setInterval(pollSensor, 3000);

  function checkAudio() {
    PS.audioInputs().then(function (a) {
      audio = a;
      var label = { available: "Input detected", none: "No input found", unsupported: "Unavailable", error: "Error" }[a.state];
      $("auChip").innerHTML = PS.connChip(a.state === "available" ? "connected" : a.state === "error" ? "error" : "disconnected", label);
      $("auText").textContent = a.message; hardware();
      PS.api("/audio/status").then(function (m) {
        if (!m.available) $("auText").textContent = a.message + ". The analysis models are unavailable: " + m.error;
      }).catch(function () {});
    });
  }
  checkAudio();
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener("devicechange", checkAudio);

  PS.api("/sessions").then(function (j) {
    var all = j.sessions, last = all[all.length - 1];
    lastSession = last;
    $("rxAudio").textContent = last ? PS.fmtDate(last.created_at) : "None yet";
    $("stats").innerHTML =
      '<div class="stat"><b>' + PS.esc(u.name.split(" ")[0]) + "</b><span>Your ID: " + PS.esc(u.id) + "</span></div>" +
      '<div class="stat"><b>' + all.length + "</b><span>Saved sessions</span></div>" +
      '<div class="stat"><b>' + (last ? PS.fmtDay(last.created_at) : "\u2014") + "</b><span>Last measurement</span></div>";
    $("latest").innerHTML = last
      ? '<p class="small muted" style="margin-bottom:14px">' + PS.fmtDate(last.created_at) + " &middot; " + PS.esc(last.filename || "recording") + (last.source === "live" ? " &middot; recorded live" : "") + "</p>" + PS.audioView(last) +
        PS.recordingPlayer(last) + '<div class="actions"><a class="btn primary sm" href="results.html?id=' + last.session_id + '">Full result</a><a class="btn ghost sm" href="reports.html?id=' + last.session_id + '">Open report</a></div>' + PS.disclaimer
      : '<div class="empty" style="height:120px">No respiratory analysis yet. Record or upload a breathing sound to create your first session.</div>';
    var rows = all.slice(-5).reverse().map(function (s) {
      return '<tr><td><a href="results.html?id=' + s.session_id + '">' + PS.fmtDate(s.created_at) + "</a></td><td>" + (s.source === "live" ? "Recorded" : "Uploaded") + '</td><td class="num">' + PS.pct(s.wheeze_score) + (s.wheeze_detected ? " (detected)" : "") + '</td><td class="num">' + PS.pct(s.crackle_score) + (s.crackle_detected ? " (detected)" : "") + "</td></tr>";
    }).join("");
    $("recent").innerHTML = rows ? '<table class="tbl"><thead><tr><th>Date</th><th>Source</th><th>Wheeze score</th><th>Crackle score</th></tr></thead><tbody>' + rows + "</tbody></table>" : '<p class="muted">Nothing saved yet.</p>';
  }).catch(function (e) { $("latest").innerHTML = '<div class="msg err show">' + PS.esc(e.message) + "</div>"; });

  PS.research.get().then(function (o) { $("objective").innerHTML = PS.research.objectiveBox(o, false); }).catch(function () {});
});
