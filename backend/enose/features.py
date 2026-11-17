"""Turns one measurement (a time series of MQ readings) into a fixed feature vector for the electronic-nose model."""
import numpy as np
import pandas as pd

from .schema import CHANNELS, ENVIRONMENT


def extract_features(df: pd.DataFrame) -> dict:
    """df: rows of one measurement with time_s, phase, mq135, mq7, mq2 (+ optional temperature, humidity).
    Features per channel: baseline level, peak response above baseline, relative response, slope during exposure,
    area under the exposure curve and recovery fraction. Raises ValueError if a phase is missing."""
    need = {"time_s", "phase", *CHANNELS}
    missing = need - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {sorted(missing)}")
    base, expo, rec = (df[df["phase"] == p].sort_values("time_s") for p in ("baseline", "exposure", "recovery"))
    if len(base) < 3 or len(expo) < 3:
        raise ValueError("A measurement needs at least 3 baseline and 3 exposure readings.")
    f = {}
    for ch in CHANNELS:
        b = float(base[ch].mean())
        e = expo[ch].to_numpy(dtype=float)
        t = expo["time_s"].to_numpy(dtype=float)
        peak = float(e.max() - b)
        f[f"{ch}_baseline"] = b
        f[f"{ch}_peak_response"] = peak
        f[f"{ch}_relative_response"] = peak / b if b else 0.0
        f[f"{ch}_slope"] = float(np.polyfit(t, e, 1)[0]) if np.ptp(t) > 0 else 0.0
        f[f"{ch}_area"] = float(np.sum((e[1:] + e[:-1] - 2 * b) / 2 * np.diff(t))) if np.ptp(t) > 0 else 0.0
        f[f"{ch}_recovery_fraction"] = float((e.max() - rec[ch].iloc[-1]) / (e.max() - b)) if len(rec) and (e.max() - b) > 1e-9 else float("nan")
    for k in ENVIRONMENT:
        if k in df.columns:
            f[f"{k}_mean"] = float(df[k].mean())
    return f


FEATURE_NAMES = [f"{ch}_{s}" for ch in CHANNELS for s in ("baseline", "peak_response", "relative_response", "slope", "area", "recovery_fraction")] \
    + [f"{k}_mean" for k in ENVIRONMENT]
