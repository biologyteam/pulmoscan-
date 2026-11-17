"""Data contract for the electronic-nose dataset the team will collect with its own hardware."""

CHANNELS = ["mq135", "mq7", "mq2"]            # same names the ESP32 already posts to /api/sensors/reading
ENVIRONMENT = ["temperature", "humidity"]
PHASES = ["baseline", "exposure", "recovery"]  # clean-air reference, breath/sample exposure, return to clean air
LABELS = {0: "non-asthma", 1: "asthma"}        # replace if the clinical protocol defines other groups

# One row = one timestamped reading. Rows that share sample_id form one measurement.
DATASET_COLUMNS = {
    "sample_id": "unique id of one measurement (one breath sample)",
    "subject_id": "participant id. Cross-validation is grouped by this so one person never appears in train and test",
    "label": "reference label from the clinical protocol (see LABELS)",
    "time_s": "seconds since the start of the measurement",
    "phase": "baseline | exposure | recovery",
    "mq135": "raw sensor value", "mq7": "raw sensor value", "mq2": "raw sensor value",
    "temperature": "deg C", "humidity": "% RH",
    "device_id": "which e-nose unit recorded it", "batch_id": "collection day / session id (used for batch-effect checks)",
}

MANIFEST_CONTRACT = {
    "name": "free text", "version": "e.g. 1.0.0", "modality": "must be 'electronic_nose'",
    "task": "what the model predicts, e.g. 'asthma vs non-asthma from exhaled breath'",
    "dataset": {"id": "...", "n_subjects": 0, "n_samples": 0, "collection_protocol": "..."},
    "sensors": CHANNELS, "features": "ordered list of feature names produced by enose/features.py",
    "labels": {"0": "non-asthma", "1": "asthma"}, "model_file": "model.joblib (a fitted scikit-learn estimator or pipeline)",
    "calibrated": "true only if probabilities were calibrated and checked", "validation_report": "enose_validation.json",
}
