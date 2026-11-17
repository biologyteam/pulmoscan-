// Research status helpers shared by Home, Dashboard and Electronic Nose pages.
// Everything shown here comes from GET /api/research/overview. The page never invents a prediction, score or accuracy.
(function () {
  var R = PS.research = {};
  var cache = null;
  R.get = function () {
    if (!cache) cache = PS.api("/research/overview");
    return cache;
  };
  function f2(x) { return x == null ? "n/a" : Number(x).toFixed(2); }
  R.chip = function (state, label) { return '<span class="state s-' + PS.esc(state) + '">' + PS.esc(label) + "</span>"; };

  // One card per component. compact=true is used on Home and Dashboard.
  R.card = function (c, compact) {
    var kind = c.id === "audio" ? " sep" : "";
    var h = '<div class="comp' + kind + '"><h3>' + PS.esc(c.name) + "</h3>" + R.chip(c.status.state, c.status.label) +
      '<p class="role">' + PS.esc(c.role) + "</p>";
    if (!compact) {
      h += "<dl><dt>Data</dt><dd>" + PS.esc(c.modality) + "</dd><dt>Task</dt><dd>" + PS.esc(c.task) + "</dd></dl>";
      (c.notes || []).forEach(function (n) { h += '<p class="sidenote">' + PS.esc(n) + "</p>"; });
    }
    return h + '<a class="more" href="' + PS.href(c.link.replace(/^pages\//, "")) + '">' + (c.id === "audio" ? "Open audio analysis" : "Open Electronic Nose") + " &rarr;</a></div>";
  };
  R.cards = function (o, compact) { return '<div class="cards3">' + o.components.map(function (c) { return R.card(c, compact); }).join("") + "</div>"; };

  R.objectiveBox = function (o, withStatus) {
    var a = o.asthma_classification;
    return '<div class="objective"><span class="kicker">Central research objective</span><h2>' + PS.esc(o.objective.title) + "</h2><p>" + PS.esc(o.objective.statement) + "</p>" +
      (withStatus ? '<p class="mt"><b>Asthma classification:</b> ' + R.chip(a.state, a.label) + '</p><p class="small muted">' + PS.esc(a.message) + "</p>" : "") + "</div>";
  };

  R.gates = function (v) {
    if (!v || !v.gates || !v.gates.length) return '<p class="muted">No validation report exists yet, so no gate has been assessed.</p>';
    var core = v.gates.filter(function (g) { return g.core; });
    var pct = v.total ? Math.round(100 * v.passed / v.total) : 0;
    var h = "<p><b>" + v.passed + " of " + v.total + "</b> core validation gates passed.</p><div class=\"meter\" role=\"img\" aria-label=\"" + v.passed + " of " + v.total + " gates passed\"><i style=\"width:" + pct + '%"></i></div><ul class="gates">';
    v.gates.forEach(function (g) {
      var m = g.passed === true ? ["pass", "Passed"] : g.passed === false ? ["fail", "Not met"] : ["", "Not assessed"];
      h += '<li><span class="mark ' + m[0] + '">' + m[1] + "</span><span>" + PS.esc(g.title) + (g.core ? "" : " (optional)") + "<small>" + PS.esc(g.detail) + "</small></span></li>";
    });
    return h + "</ul>";
  };

  R.f2 = f2;
})();
