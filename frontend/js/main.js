// Shared helpers: Chart.js defaults and colours. (No sample-data generator: the site only ever shows real measurements.)
(function () {
  window.PS = {
    colors: { maroon: "#6b0707", slate: "#5b6272", rose: "#c98a8a", line: "#e4e6eb" },
    chartsReady: function () {
      if (!window.Chart) return false;
      Chart.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif';
      Chart.defaults.color = "#5b6272";
      Chart.defaults.borderColor = "#e4e6eb";
      return true;
    }
  };
  var y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
})();
