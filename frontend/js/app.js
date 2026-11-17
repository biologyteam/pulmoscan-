// Shared app helpers: API calls (same-origin, no hardcoded host), login state, navigation, gauges.
(function () {
  var PS = window.PS = window.PS || {};
  var inPages = location.pathname.indexOf("/pages/") !== -1;
  var pagesDir = inPages ? "" : "pages/";            // links relative to the current page
  PS.href = function (page) { return pagesDir + page; };

  // API paths are relative to wherever the page was served from. When the site is opened as a file,
  // there is no backend to talk to, so say so instead of failing silently.
  PS.apiBase = location.protocol === "file:" ? null : "";
  PS.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  PS.api = function (path, opts) {
    opts = opts || {};
    if (PS.apiBase === null) return Promise.reject(new Error("This page was opened as a file. Start the backend and open http://localhost:8000 instead."));
    var init = { method: opts.method || "GET", credentials: "same-origin", headers: {} };
    if (opts.json) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.json); }
    if (opts.form) init.body = opts.form;
    return fetch(PS.apiBase + "/api" + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error(typeof j.detail === "string" ? j.detail : (Array.isArray(j.detail) ? "Please check the form: " + j.detail.map(function (d) { return (d.loc || []).slice(-1) + " " + d.msg; }).join("; ") : "Server error " + r.status));
          e.status = r.status; throw e;
        }
        return j;
      });
    }, function () { throw new Error("Cannot reach the server. Make sure the backend is running (uvicorn main:app) and open http://localhost:8000."); });
  };

  PS.fmtDate = function (iso) { var d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); };
  PS.fmtDay = function (iso) { var d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); };
  PS.pct = function (x) { return Math.round(x * 100) + "%"; };
  PS.msg = function (el, kind, text) { el.className = "msg show " + kind; el.textContent = text; };

  // Circular indicator. value 0..1 is the model's actual output; threshold (optional) is drawn as a tick.
  PS.gauge = function (value, name, sub, threshold, hit) {
    var r = 60, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, value)));
    var tick = "";
    if (threshold != null) {
      var a = threshold * 2 * Math.PI - Math.PI / 2, x1 = 80 + (r - 9) * Math.cos(a), y1 = 80 + (r - 9) * Math.sin(a), x2 = 80 + (r + 9) * Math.cos(a), y2 = 80 + (r + 9) * Math.sin(a);
      tick = '<line class="tick" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
    }
    return '<div class="gauge" role="img" aria-label="' + PS.esc(name) + ': ' + PS.pct(value) + '">' +
      '<svg viewBox="0 0 160 160"><circle class="track" cx="80" cy="80" r="' + r + '"/>' +
      '<circle class="arc' + (hit ? "" : " low") + '" cx="80" cy="80" r="' + r + '" transform="rotate(-90 80 80)" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/>' + tick +
      '<text class="v" x="80" y="84" text-anchor="middle">' + PS.pct(value) + '</text><text class="u" x="80" y="104" text-anchor="middle">model score</text></svg>' +
      '<div class="name">' + PS.esc(name) + '</div><div class="sub">' + sub + '</div></div>';
  };

  // Login state + navigation. Existing nav links are kept; account links are added after them.
  var nav = document.querySelector("header.site nav");
  var needAuth = document.body.getAttribute("data-auth") === "required";
  PS.ready = PS.api("/auth/me").then(function (j) { PS.user = j.user; }, function (e) { PS.user = null; if (e.status && e.status !== 401) PS.navError = e; })
    .then(function () {
      var hdr = document.querySelector("header.site");
      if (hdr) {
        // Account links go in a slim second bar so the original navigation keeps its layout.
        var here = location.pathname.split("/").pop();
        var links = PS.user ? [["history.html", "History"], ["reports.html", "Reports"], ["profile.html", "Profile"]]
                            : [["login.html", "Log in"], ["register.html", "Register"]];
        var bar = document.createElement("nav"); bar.className = "acctbar"; bar.setAttribute("aria-label", "Account");
        var inner = document.createElement("div"); inner.className = "wrap";
        if (PS.user) { var who = document.createElement("span"); who.className = "who"; who.textContent = PS.user.name + " \u00b7 " + PS.user.id; inner.appendChild(who); }
        links.forEach(function (l) {
          var a = document.createElement("a"); a.href = PS.href(l[0]); a.textContent = l[1];
          if (here === l[0] || (l[0] === "reports.html" && here === "results.html")) a.setAttribute("aria-current", "page");
          inner.appendChild(a);
        });
        if (PS.user) {
          var b = document.createElement("button"); b.type = "button"; b.className = "linkbtn"; b.textContent = "Log out";
          b.onclick = function () { PS.api("/auth/logout", { method: "POST" }).then(function () { location.href = PS.href("login.html"); }); };
          inner.appendChild(b);
        }
        bar.appendChild(inner); hdr.appendChild(bar);
      }
      if (needAuth && !PS.user) {
        var next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
        location.replace(PS.href("login.html") + "?next=" + next);
        return new Promise(function () {});          // stop page scripts while redirecting
      }
      return PS.user;
    });
})();

// Result view shared by Dashboard, Results and the Breathing Analysis page. Takes one saved session object.
PS.audioView = function (s) {
  function cls(hit, what) { return '<span class="chip ' + (hit ? "hit" : "no") + '">' + (hit ? what + "-like pattern detected" : "No " + what.toLowerCase() + "-like pattern detected") + "</span>"; }
  return '<div class="gauges">' +
    PS.gauge(s.wheeze_score, "Wheeze model", "threshold " + PS.pct(s.wheeze_threshold), s.wheeze_threshold, s.wheeze_detected) +
    PS.gauge(s.crackle_score, "Crackle model", "threshold " + PS.pct(s.crackle_threshold), s.crackle_threshold, s.crackle_detected) + "</div>" +
    '<p class="mt">' + cls(s.wheeze_detected, "Wheeze") + " " + cls(s.crackle_detected, "Crackle") + "</p>" +
    '<p class="small muted mt">Each ring shows the model&rsquo;s actual output for this recording: the share of its decision trees that voted for the pattern, averaged over ' + s.windows + " three-second window" + (s.windows === 1 ? "" : "s") +
    ". The black tick marks the decision threshold the model uses. A pattern is reported when the score reaches the tick. Overall confidence (distance from the threshold, both models averaged): <b>" + PS.pct(s.confidence) +
    "</b>. These are acoustic findings about the recording, not the probability that a person has asthma or any other condition.</p>";
};
PS.disclaimer = '<div class="warn mt">Research prototype. This is not a clinically validated diagnostic system. A respiratory sound pattern is not an asthma diagnosis; speak to a clinician about any health concern.</div>';

// Connection-state chip (Connected / Disconnected / Receiving Data / Error). state is the backend's state id.
PS.connChip = function (state, label) { return '<span class="state conn s-' + PS.esc(state) + '"><i class="dot"></i>' + PS.esc(label) + "</span>"; };

// Are there audio input devices the browser can record from? Does not open the microphone, so no permission prompt.
PS.audioInputs = function () {
  var md = navigator.mediaDevices;
  if (!md || !md.enumerateDevices || !md.getUserMedia) {
    return Promise.resolve({ state: "unsupported", count: 0, devices: [],
      message: window.isSecureContext ? "This browser cannot access audio input devices." : "Audio capture needs a secure page. Open the site at http://localhost:8000 (or over HTTPS) instead of a network address." });
  }
  return md.enumerateDevices().then(function (list) {
    var ins = list.filter(function (d) { return d.kind === "audioinput"; });
    return { state: ins.length ? "available" : "none", count: ins.length, devices: ins,
      message: ins.length ? ins.length + " audio input" + (ins.length === 1 ? "" : "s") + " detected" : "No audio input found. Connect the stethoscope's audio interface." };
  }, function (e) { return { state: "error", count: 0, devices: [], message: e.message || "Could not list audio devices." }; });
};

// How long ago, in words ("5 s ago", "3 min ago").
PS.ago = function (iso) {
  var s = (Date.now() - new Date(iso).getTime()) / 1000; if (isNaN(s)) return "";
  if (s < 0) s = 0; if (s < 60) return Math.round(s) + " s ago"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago";
  return Math.round(s / 86400) + " d ago";
};

// Sensor labels and units. Gas values are raw device output, so no unit is claimed for them.
PS.sensorDefs = [
  { key: "mq135", name: "MQ-135 (gas sensor)", unit: "" }, { key: "mq7", name: "MQ-7 (gas sensor)", unit: "" }, { key: "mq2", name: "MQ-2 (gas sensor)", unit: "" },
  { key: "temperature", name: "Temperature", unit: " \u00b0C", dp: 1 }, { key: "humidity", name: "Humidity", unit: " %", dp: 0 }];
PS.fmtSensor = function (d, v) { return v == null ? "\u2014" : (d.dp != null ? Number(v).toFixed(d.dp) : String(Math.round(v * 100) / 100)) + d.unit; };

// Player for the audio stored with a saved session (only its owner can fetch it).
PS.recordingPlayer = function (s) {
  return s && s.has_recording ? '<audio controls preload="metadata" src="' + PS.apiBase + "/api/sessions/" + encodeURIComponent(s.session_id) + '/audio"></audio>' : "";
};
