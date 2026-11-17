// Audio Analysis page: check the audio input, record from the stethoscope (or upload a file), preview, analyze, save.
(function () {
  var MAX_BYTES = 25 * 1024 * 1024, EXT = /\.(wav|flac|ogg)$/i, MAX_REC_S = 30, MIN_REC_S = 1;
  var $ = function (id) { return document.getElementById(id); };
  var input = $("file"), player = $("player"), wave = $("wave"), spec = $("spec"), live = $("live"), btn = $("analyze"), out = $("result"),
      notice = $("notice"), visual = $("visual"), statusEl = $("status"), recBtn = $("rec"), devSel = $("dev"), file = null, source = "upload", session = null;

  function fit(c) { var d = window.devicePixelRatio || 1; c.width = c.clientWidth * d; c.height = c.clientHeight * d; return c.getContext("2d"); }
  function setChip(id, state, label) { $(id).innerHTML = PS.connChip(state, label); }
  function mmss(s) { s = Math.floor(s); return ("0" + Math.floor(s / 60)).slice(-2) + ":" + ("0" + (s % 60)).slice(-2); }

  // ---------- waveform + spectrogram preview (unchanged) ----------
  function drawWave(d) {
    var g = fit(wave), w = wave.width, h = wave.height, step = Math.max(1, Math.floor(d.length / w));
    g.clearRect(0, 0, w, h); g.strokeStyle = "#6b0707"; g.lineWidth = 1; g.beginPath();
    for (var x = 0; x < w; x++) {
      var mn = 1, mx = -1;
      for (var j = 0; j < step; j++) { var v = d[x * step + j] || 0; if (v < mn) mn = v; if (v > mx) mx = v; }
      g.moveTo(x, (1 - mx) * h / 2); g.lineTo(x, (1 - mn) * h / 2 + 1);
    }
    g.stroke();
  }
  function fft(re, im) {
    var n = re.length, i, j = 0, k, t;
    for (i = 1; i < n; i++) { k = n >> 1; for (; j & k; k >>= 1) j ^= k; j ^= k; if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (var len = 2; len <= n; len <<= 1) {
      var a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var u = i + k, v = u + len / 2, xr = re[v] * cr - im[v] * ci, xi = re[v] * ci + im[v] * cr;
          re[v] = re[u] - xr; im[v] = im[u] - xi; re[u] += xr; im[u] += xi;
          t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  function color(t) {
    var a = t < .5 ? [255, 255, 255] : [201, 138, 138], b = t < .5 ? [201, 138, 138] : [107, 7, 7], u = t < .5 ? t * 2 : (t - .5) * 2;
    return a.map(function (c, i) { return Math.round(c + (b[i] - c) * u); });
  }
  function drawSpec(d, sr) {
    var N = 512, cols = Math.min(600, Math.floor((d.length - N) / 256));
    if (cols < 2) return;
    var hop = Math.floor((d.length - N) / cols), bins = Math.min(N / 2, Math.floor(4000 / (sr / N))), mag = [], max = -1e9, re = new Float32Array(N), im = new Float32Array(N), c, b, i;
    for (c = 0; c < cols; c++) {
      for (i = 0; i < N; i++) { re[i] = (d[c * hop + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
      fft(re, im); var col = new Float32Array(bins);
      for (b = 0; b < bins; b++) { col[b] = 20 * Math.log10(Math.hypot(re[b], im[b]) + 1e-9); if (col[b] > max) max = col[b]; }
      mag.push(col);
    }
    var tmp = document.createElement("canvas"); tmp.width = cols; tmp.height = bins;
    var tg = tmp.getContext("2d"), img = tg.createImageData(cols, bins);
    for (c = 0; c < cols; c++) for (b = 0; b < bins; b++) {
      var t = Math.min(1, Math.max(0, (mag[c][b] - (max - 70)) / 70)), p = color(t), o = ((bins - 1 - b) * cols + c) * 4;
      img.data[o] = p[0]; img.data[o + 1] = p[1]; img.data[o + 2] = p[2]; img.data[o + 3] = 255;
    }
    tg.putImageData(img, 0, 0);
    var g = fit(spec); g.imageSmoothingEnabled = true; g.drawImage(tmp, 0, 0, spec.width, spec.height);
  }

  // ---------- model availability ----------
  PS.ready.then(function (u) {
    if (!u) return;
    PS.api("/audio/status").then(function (st) {
      if (!st.available) PS.msg(statusEl, "err", "The audio model is unavailable: " + st.error);
    }).catch(function (e) { PS.msg(statusEl, "err", e.message); });
    refreshDevices(false);
  });

  // ---------- audio input ----------
  var stream = null, ctx = null, rafMeter = 0;
  function inputError(e) {
    var n = e && e.name;
    if (n === "NotAllowedError" || n === "SecurityError") return "Permission to use the audio input was denied. Allow microphone access for this site in the browser, then try again.";
    if (n === "NotFoundError" || n === "DevicesNotFoundError") return "No audio input was found. Connect the stethoscope's audio interface and try again.";
    if (n === "NotReadableError" || n === "AbortError") return "The audio input could not be opened. Another application may be using it; close it and try again.";
    if (n === "NotSupportedError" || n === "TypeError") return "This browser or page cannot use the audio input. Open the site at http://localhost:8000 (or over HTTPS) in a current browser and allow microphone access.";
    if (n === "OverconstrainedError") return "The selected device is no longer available. Pick another input and try again.";
    return (e && e.message) || "The audio input could not be opened.";
  }
  function refreshDevices(withLabels) {
    return PS.audioInputs().then(function (a) {
      if (a.state === "unsupported") { setChip("inChip", "disconnected", "Unavailable"); $("inInfo").textContent = a.message; check.disabled = true; recBtn.disabled = true; return a; }
      var keep = devSel.value;
      devSel.innerHTML = '<option value="">Default input</option>' + a.devices.filter(function (d) { return d.deviceId && d.deviceId !== "default"; }).map(function (d, i) {
        return '<option value="' + PS.esc(d.deviceId) + '">' + PS.esc(d.label || "Audio input " + (i + 1)) + "</option>"; }).join("");
      devSel.value = keep;
      if (!devSel.value) devSel.value = "";
      if (a.state === "none") { setChip("inChip", "disconnected", "No input found"); $("inInfo").textContent = a.message; }
      return a;
    });
  }
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener("devicechange", function () { if (!stream) refreshDevices(true); });
  var check = $("check");

  function openInput() {
    var c = { audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
    if (devSel.value) c.audio.deviceId = { exact: devSel.value };
    return navigator.mediaDevices.getUserMedia(c);
  }
  function release() {
    cancelAnimationFrame(rafMeter); $("lvl").style.width = "0";
    if (stream) { stream.getTracks().forEach(function (t) { t.onended = null; t.stop(); }); stream = null; }
    if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; }
  }
  function rms(an, buf) { an.getFloatTimeDomainData(buf); var s = 0; for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); }

  // "Check audio input": open the device for a few seconds, show the live level, then release it.
  check.addEventListener("click", function () {
    if (recorder) return;
    release(); notice.className = "msg"; $("inMsg").className = "msg"; check.disabled = true; setChip("inChip", "disconnected", "Checking…");
    openInput().then(function (s) {
      stream = s; var track = s.getAudioTracks()[0], st = track.getSettings ? track.getSettings() : {};
      ctx = new (window.AudioContext || window.webkitAudioContext)(); var an = ctx.createAnalyser(); an.fftSize = 2048;
      ctx.createMediaStreamSource(s).connect(an); var buf = new Float32Array(an.fftSize), peak = 0, t0 = Date.now();
      refreshDevices(true).then(function () { if (st.deviceId) devSel.value = st.deviceId; if (devSel.value !== st.deviceId) devSel.value = ""; });
      $("inInfo").textContent = "Opened: " + (track.label || "audio input") + (ctx.sampleRate ? " at " + ctx.sampleRate + " Hz" : "") + ". Tap or breathe on the stethoscope to see the level move.";
      (function tick() {
        var r = rms(an, buf); peak = Math.max(peak, r); $("lvl").style.width = Math.min(100, r * 400) + "%";
        if (Date.now() - t0 < 6000) { rafMeter = requestAnimationFrame(tick); return; }
        release(); check.disabled = false;
        if (peak > 0.002) { setChip("inChip", "connected", "Ready"); $("inInfo").textContent = (track.label || "Audio input") + " is working: a signal was detected."; }
        else { setChip("inChip", "error", "No signal"); $("inInfo").textContent = (track.label || "Audio input") + " opened, but no signal was detected. Check the stethoscope connection, its volume or gain, and that the right input is selected."; }
      })();
    }).catch(function (e) {
      release(); check.disabled = false; setChip("inChip", "error", "Blocked"); PS.msg($("inMsg"), "err", inputError(e)); $("inInfo").textContent = "";
    });
  });

  // ---------- recording ----------
  var recorder = null;
  function drawLive(an, buf) {
    var g = fit(live), w = live.width, h = live.height; an.getFloatTimeDomainData(buf);
    g.clearRect(0, 0, w, h); g.strokeStyle = "#6b0707"; g.lineWidth = 1.5 * (window.devicePixelRatio || 1); g.beginPath();
    for (var x = 0; x < w; x++) { var v = buf[Math.floor(x / w * buf.length)] || 0, y = (1 - Math.max(-1, Math.min(1, v * 3))) * h / 2; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  function startCapture(s, onChunk) {      // AudioWorklet where available, ScriptProcessor as a fallback
    var src = ctx.createMediaStreamSource(s), mute = ctx.createGain(); mute.gain.value = 0; mute.connect(ctx.destination);   // keeps the graph running without playing the input back
    var an = ctx.createAnalyser(); an.fftSize = 2048; src.connect(an);
    function fallback() {
      var sp = ctx.createScriptProcessor(4096, 1, 1); sp.onaudioprocess = function (e) { onChunk(new Float32Array(e.inputBuffer.getChannelData(0))); };
      src.connect(sp); sp.connect(mute); return { analyser: an, stop: function () { sp.onaudioprocess = null; try { sp.disconnect(); } catch (e) {} } };
    }
    if (!ctx.audioWorklet || !window.AudioWorkletNode) return Promise.resolve(fallback());
    var code = "class R extends AudioWorkletProcessor{process(i){var c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('ps-rec',R)";
    var url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
    return ctx.audioWorklet.addModule(url).then(function () {
      var node = new AudioWorkletNode(ctx, "ps-rec", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
      node.port.onmessage = function (e) { onChunk(e.data); }; src.connect(node); node.connect(mute);
      return { analyser: an, stop: function () { node.port.onmessage = null; try { node.disconnect(); } catch (e) {} } };
    }).catch(function () { return fallback(); }).then(function (r) { URL.revokeObjectURL(url); return r; });
  }

  function startRecording() {
    release(); notice.className = "msg"; visual.innerHTML = ""; $("recMsg").className = "msg"; $("inMsg").className = "msg"; session = null;
    recBtn.disabled = true; check.disabled = true;
    openInput().then(function (s) {
      stream = s; ctx = new (window.AudioContext || window.webkitAudioContext)();
      var resume = ctx.state === "suspended" ? ctx.resume() : Promise.resolve(), chunks = [], samples = 0;
      return resume.then(function () {
        return startCapture(s, function (c) { chunks.push(c); samples += c.length; });
      }).then(function (cap) {
        var buf = new Float32Array(cap.analyser.fftSize), sr = ctx.sampleRate, track = s.getAudioTracks()[0], label = track.label || "audio input", ended = false;
        recorder = { stop: finish };
        recBtn.disabled = false; recBtn.textContent = "Stop recording"; recBtn.className = "btn rec-on"; setChip("recChip", "receiving_data", "Recording");
        refreshDevices(true);
        track.onended = function () { ended = true; finish(); };
        var timer = setInterval(function () { var secs = samples / sr; $("timer").textContent = mmss(secs); if (secs >= MAX_REC_S) finish(); }, 150);
        (function loop() { if (!recorder) return; drawLive(cap.analyser, buf); rafMeter = requestAnimationFrame(loop); })();
        function finish() {
          if (!recorder) return; recorder = null; clearInterval(timer); cap.stop(); release();
          recBtn.textContent = "Start recording"; recBtn.className = "btn primary"; recBtn.disabled = false; check.disabled = false;
          var all = PS.wav.concat(chunks), secs = all.length / sr;
          if (ended) PS.msg($("recMsg"), "err", "The audio input was disconnected, so recording stopped at " + secs.toFixed(1) + " s.");
          if (secs < MIN_REC_S) { setChip("recChip", "error", "Too short"); PS.msg($("recMsg"), "err", "The recording is shorter than 1 second. Record for at least 1 second."); return; }
          var st = PS.wav.stats(all);
          setChip("recChip", "connected", "Recorded " + mmss(secs));
          if (st.peak < 0.002) PS.msg($("recMsg"), "err", "The recording is almost silent. Check the stethoscope connection and volume before analyzing; the result would not mean anything.");
          else if (!ended) PS.msg($("recMsg"), "ok", "Recording finished (" + secs.toFixed(1) + " s, " + label + "). Review it below, then analyze.");
          var stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          prepare(new File([PS.wav.encode(all, sr)], "stethoscope-" + stamp + ".wav", { type: "audio/wav" }), "live");
        }
      });
    }).catch(function (e) {
      release(); recorder = null; recBtn.disabled = false; check.disabled = false; setChip("recChip", "error", "Error"); PS.msg($("recMsg"), "err", inputError(e));
    });
  }
  recBtn.addEventListener("click", function () { if (recorder) recorder.stop(); else startRecording(); });
  setChip("recChip", "disconnected", "Idle");
  window.addEventListener("pagehide", release);

  // ---------- a prepared file (recorded or uploaded) ----------
  function prepare(f, src) {
    file = f; source = src; session = null; visual.innerHTML = "";
    player.src = URL.createObjectURL(f); player.hidden = false; btn.disabled = false; $("src").textContent = src === "live" ? "Live recording" : "Uploaded file";
    out.innerHTML = '<tr><td colspan="2" class="muted">Press &ldquo;Analyze and save session&rdquo; to send this recording to the models.</td></tr>';
    f.arrayBuffer().then(function (buf) {
      var c = new (window.AudioContext || window.webkitAudioContext)();
      return c.decodeAudioData(buf).then(function (ab) { c.close(); return ab; });
    }).then(function (ab) {
      var d = ab.getChannelData(0).subarray(0, ab.sampleRate * 30);
      $("dur").textContent = ab.duration.toFixed(1) + " s"; $("sr").textContent = ab.sampleRate + " Hz";
      drawWave(d); drawSpec(d, ab.sampleRate);
      if (ab.duration < 1) PS.msg(notice, "err", "This recording is shorter than 1 second. The model needs at least 1 second.");
    }).catch(function () { PS.msg(notice, "info", "A preview could not be drawn in this browser. You can still analyze the file; the server will check it."); });
  }
  input.addEventListener("change", function () {
    var f = input.files[0]; notice.className = "msg"; visual.innerHTML = ""; if (!f) return;
    if (!EXT.test(f.name)) { file = null; btn.disabled = true; return PS.msg(notice, "err", "Unsupported file type. Choose a WAV, FLAC or OGG recording."); }
    if (f.size > MAX_BYTES) { file = null; btn.disabled = true; return PS.msg(notice, "err", "This file is larger than 25 MB."); }
    if (f.size < 100) { file = null; btn.disabled = true; return PS.msg(notice, "err", "This file is empty."); }
    prepare(f, "upload");
  });

  // ---------- analyze + save ----------
  btn.addEventListener("click", function () {
    if (!file || recorder) return;
    var fd = new FormData(); fd.append("file", file); fd.append("source", source); btn.disabled = true; visual.innerHTML = "";
    btn.innerHTML = '<span class="spin"></span>Analyzing…'; notice.className = "msg";
    PS.api("/audio/analyze", { method: "POST", form: fd }).then(function (j) {
      session = j;
      visual.innerHTML = PS.audioView(j) + '<div class="actions"><a class="btn primary sm" href="results.html?id=' + j.session_id + '">Open result</a><a class="btn ghost sm" href="reports.html?id=' + j.session_id + '">Open report</a></div>';
      out.innerHTML = "<tr><td>Wheeze-like pattern</td><td>" + (j.wheeze ? "Detected" : "Not detected") + " (score " + PS.pct(j.wheeze_score) + ", threshold " + PS.pct(j.wheeze_threshold) + ")</td></tr>" +
        "<tr><td>Crackle-like pattern</td><td>" + (j.crackle ? "Detected" : "Not detected") + " (score " + PS.pct(j.crackle_score) + ", threshold " + PS.pct(j.crackle_threshold) + ")</td></tr>" +
        "<tr><td>Model confidence</td><td>" + (j.confidence != null ? (j.confidence * 100).toFixed(0) + " %" : "\u2014") + "</td></tr>" +
        "<tr><td>Saved as</td><td>Session " + j.session_id + " (" + PS.fmtDate(j.created_at) + "), recording stored with the session</td></tr>";
      PS.msg(notice, "ok", "Analysis complete. The recording and its results were saved to your history.");
    }).catch(function (e) {
      if (e.status === 401) return location.href = "login.html?next=breathing-analysis.html";
      out.innerHTML = '<tr><td colspan="2" class="muted">No result. ' + PS.esc(e.message) + "</td></tr>";
      PS.msg(notice, "err", e.message);                       // real error, never a made-up result
    }).finally(function () { btn.disabled = !file; btn.textContent = "Analyze and save session"; });
  });
})();
