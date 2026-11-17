(function () {
  var f = document.getElementById("f"), m = document.getElementById("m"), go = document.getElementById("go");
  var next = new URLSearchParams(location.search).get("next");
  var safe = next && /^[\w\-]+\.html(\?[\w=&%\-]*)?$/.test(next) ? next : "dashboard.html";   // only same-folder pages
  PS.ready.then(function (u) { if (u) location.replace(safe); });
  f.addEventListener("submit", function (e) {
    e.preventDefault(); m.className = "msg";
    var email = document.getElementById("email").value.trim(), pw = document.getElementById("pw").value;
    if (!email || !pw) return PS.msg(m, "err", "Enter your email and password.");
    go.disabled = true; go.textContent = "Logging in…";
    PS.api("/auth/login", { method: "POST", json: { email: email, password: pw } })
      .then(function () { location.href = safe; })
      .catch(function (err) { PS.msg(m, "err", err.message); go.disabled = false; go.textContent = "Log in"; });
  });
})();
