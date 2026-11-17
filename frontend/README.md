# E-Nose PulmoScan website

The backend serves this folder, so always open **http://localhost:8000** (see the main README). Opening the files directly
does not work because every page talks to the API. Audio capture also needs `localhost` or HTTPS: a browser refuses
microphone access on a plain `http://<ip-address>` page.

- `css/`: style.css (shared), dashboard.css (panels, tables), app.css (accounts, status chips, gauges), responsive.css
- `js/app.js`: API helper, login state, connection chips, audio-input detection. `js/main.js`: Chart.js defaults
- `js/wav.js`: encodes the recorded audio as a WAV file in the browser
- `js/vendor/chart.umd.js`: Chart.js, bundled so charts work offline
- one JS file per page; `js/research.js` renders component status from `/api/research/overview`

Pages: Home, Dashboard, Audio Analysis (`breathing-analysis.html`), Electronic Nose, Model Performance, Research, About, plus
Results, History, Reports, Profile, Login and Register. Nothing on the site is simulated: charts and values come from the
backend (ESP32 readings, saved sessions, stored training results) and an empty state is shown when there is no data.
