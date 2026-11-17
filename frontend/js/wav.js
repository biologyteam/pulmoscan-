// Encodes recorded audio as a 16-bit PCM mono WAV file. Pure functions so they can be tested outside a browser.
(function (root) {
  function concat(chunks) {
    var n = 0, i; for (i = 0; i < chunks.length; i++) n += chunks[i].length;
    var out = new Float32Array(n), o = 0; for (i = 0; i < chunks.length; i++) { out.set(chunks[i], o); o += chunks[i].length; }
    return out;
  }
  function stats(samples) {                       // peak and RMS of the signal, used to warn about silent recordings
    var peak = 0, sum = 0; for (var i = 0; i < samples.length; i++) { var a = Math.abs(samples[i]); if (a > peak) peak = a; sum += samples[i] * samples[i]; }
    return { peak: peak, rms: samples.length ? Math.sqrt(sum / samples.length) : 0 };
  }
  function encode(samples, sampleRate) {
    var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return buf;
  }
  var api = { concat: concat, stats: stats, encode: encode };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else (root.PS = root.PS || {}).wav = api;
})(typeof window !== "undefined" ? window : this);
