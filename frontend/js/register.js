(function () {
  var f = document.getElementById("f"), m = document.getElementById("m"), go = document.getElementById("go");
  PS.ready.then(function (u) { if (u) location.replace("dashboard.html"); });
  f.addEventListener("submit", function (e) {
    e.preventDefault(); m.className = "msg";
    var name = document.getElementById("name").value.trim(), email = document.getElementById("email").value.trim(),
        pw = document.getElementById("pw").value, pw2 = document.getElementById("pw2").value;
    if (!name || !email) return PS.msg(m, "err", "Enter your name and email.");
    if (pw.length < 8) return PS.msg(m, "err", "Use a password with at least 8 characters.");
    if (pw !== pw2) return PS.msg(m, "err", "The two passwords do not match.");
    go.disabled = true; go.textContent = "Creating account…";
    PS.api("/auth/register", { method: "POST", json: { name: name, email: email, password: pw } })
      .then(function () { location.href = "dashboard.html"; })
      .catch(function (err) { PS.msg(m, "err", err.message); go.disabled = false; go.textContent = "Create account"; });
  });
})();
