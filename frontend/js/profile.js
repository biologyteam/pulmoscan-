PS.ready.then(function (u) {
  if (!u) return;
  function show(u) {
    document.getElementById("info").innerHTML = "<dt>User ID</dt><dd>" + PS.esc(u.id) + "</dd><dt>Name</dt><dd>" + PS.esc(u.name) + "</dd><dt>Email</dt><dd>" + PS.esc(u.email) + "</dd><dt>Member since</dt><dd>" + PS.fmtDay(u.created_at) + "</dd>";
    document.getElementById("name").value = u.name;
  }
  show(u);
  document.getElementById("nf").addEventListener("submit", function (e) {
    e.preventDefault(); var m = document.getElementById("nm");
    PS.api("/auth/profile", { method: "PUT", json: { name: document.getElementById("name").value.trim() } })
      .then(function (j) { show(j.user); PS.msg(m, "ok", "Name updated."); }).catch(function (err) { PS.msg(m, "err", err.message); });
  });
  document.getElementById("pf").addEventListener("submit", function (e) {
    e.preventDefault(); var m = document.getElementById("pm"), n = document.getElementById("new").value;
    if (n.length < 8) return PS.msg(m, "err", "Use a new password with at least 8 characters.");
    PS.api("/auth/password", { method: "PUT", json: { current_password: document.getElementById("cur").value, new_password: n } })
      .then(function () { PS.msg(m, "ok", "Password changed."); e.target.reset(); }).catch(function (err) { PS.msg(m, "err", err.message); });
  });
});
