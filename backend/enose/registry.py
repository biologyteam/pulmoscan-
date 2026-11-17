"""Loads a future electronic-nose model from models/enose_model/ and decides whether the website may use it.

Drop-in contract (see schema.MANIFEST_CONTRACT): put manifest.json + model.joblib in models/enose_model/ and the
validation report in models/enose_validation.json (written by training/train_enose.py). No website change is needed.
The model is used for predictions only when the report passes services/validation_policy.py.
"""
import json
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from services import validation_policy
from . import features, schema

MODELS = Path(__file__).resolve().parent.parent / "models"
MODEL_DIR = MODELS / "enose_model"
REPORT = MODELS / "enose_validation.json"
_cache = {"mtime": None, "bundle": None}


def _read(path: Path) -> Optional[dict]:
    try:
        return json.loads(path.read_text()) if path.exists() else None
    except (OSError, ValueError):
        return None


def manifest_problems(m: Optional[dict]) -> list:
    """Reasons the manifest cannot be used. Guards against plugging in the wrong kind of model."""
    if m is None:
        return ["models/enose_model/manifest.json not found"]
    p = []
    if m.get("modality") != "electronic_nose":
        p.append("manifest.modality must be 'electronic_nose'")
    if list(m.get("sensors") or []) != schema.CHANNELS:
        p.append(f"manifest.sensors must be {schema.CHANNELS}")
    feats = m.get("features") or []
    if not feats:
        p.append("manifest.features is empty")
    if any(str(f).isdigit() for f in feats):
        p.append("manifest.features must be names produced by enose/features.py, not numeric ids")
    if not (MODEL_DIR / m.get("model_file", "model.joblib")).exists():
        p.append("model file not found")
    return p


def status() -> dict:
    manifest, report = _read(MODEL_DIR / "manifest.json"), _read(REPORT)
    problems = manifest_problems(manifest)
    verdict = validation_policy.evaluate(report)
    if manifest is None and report is None:
        state, label = "awaiting_dataset", "Awaiting own sensor dataset"
    elif problems:
        state, label = "integration_incomplete", "Integration incomplete"
    else:
        state, label = verdict["status"], verdict["label"]
    return {"state": state, "label": label, "model_loaded_ok": not problems, "problems": problems,
            "manifest": None if manifest is None else {k: manifest.get(k) for k in ("name", "version", "task", "dataset", "calibrated", "labels")},
            "validation": verdict, "usable_for_prediction": (not problems) and verdict["status"] == "validated"}


def _bundle():
    f = MODEL_DIR / "manifest.json"
    mt = f.stat().st_mtime if f.exists() else None
    if _cache["bundle"] is None or _cache["mtime"] != mt:
        m = _read(f)
        _cache.update(mtime=mt, bundle={"manifest": m, "model": joblib.load(MODEL_DIR / m.get("model_file", "model.joblib"))})
    return _cache["bundle"]


class NotAvailable(RuntimeError):
    pass


def predict(rows: list) -> dict:
    """rows: readings of ONE measurement. Raises NotAvailable unless the model is integrated and validated."""
    st = status()
    if not st["usable_for_prediction"]:
        raise NotAvailable(st["label"])
    b = _bundle()
    feats = features.extract_features(pd.DataFrame(rows))
    names = b["manifest"]["features"]
    x = np.array([[feats.get(n, np.nan) for n in names]], dtype=float)
    est = b["model"]
    score = float(est.predict_proba(x)[0, 1])
    out = {"model": b["manifest"].get("name"), "version": b["manifest"].get("version"), "validation_status": st["label"],
           "score": round(score, 4), "score_type": "uncalibrated model score",
           "note": "Research output. Not a medical diagnosis."}
    if st["validation"]["probability_display_allowed"] and b["manifest"].get("calibrated"):
        out["score_type"] = "calibrated probability"
        out["probability"] = out["score"]
    return out
