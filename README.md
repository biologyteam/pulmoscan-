# E-Nose PulmoScan

**Central research objective: AI-based asthma detection using breath analysis.**
The physical prototype has two independent components. Neither one replaces the objective, and they are never merged into one score:

| Component | What it is | Status rule |
|---|---|---|
| Respiratory audio analysis | A stethoscope recording (captured in the browser or uploaded) is analyzed by a wheeze model and a crackle model | Separate acoustic findings; never an asthma probability. Models are trained on public ICBHI data, held-out performance is modest |
| Electronic nose | ESP32 with MQ-135 / MQ-7 / MQ-2 gas sensors and temperature / humidity, posting live readings | Live readings and connection status only. A gas-analysis model is planned (`backend/enose/`, `training/train_enose.py`) and shows "Awaiting own sensor dataset" until one is integrated and validated |

The validation gate in `backend/services/validation_policy.py` decides when any model may be shown as a classifier. The website never shows a prediction, accuracy or probability that did not come from a stored model or report, and never generates sensor values.

```
frontend/   website (HTML, CSS, JS)
backend/    FastAPI (accounts, audio models, saved sessions with recordings, ESP32 readings, results)
```

## Run
```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
Open **http://localhost:8000** (always use this address; the backend serves the website, and browsers only allow microphone access on `localhost` or HTTPS).
Register an account, then use Audio Analysis. Data is stored in `backend/data/pulmoscan.db` and recordings in `backend/data/recordings/<user>/` (created automatically; older databases are upgraded in place).
**For the ESP32** to reach the server, start it with `uvicorn main:app --host 0.0.0.0` (this exposes the server to your local network), put both devices on the same network, and post to `http://<laptop-ip>:8000/api/sensors/reading`.
Environment variables: `PULMOSCAN_DB` (database path), `PULMOSCAN_HTTPS=1` (secure cookies when served over HTTPS), `PULMOSCAN_ORIGINS` (only if you serve the frontend from another origin).

## Endpoints
- `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me`; `PUT /api/auth/profile`, `/password`
- `GET /api/audio/status`: is the model usable, and if not, why
- `POST /api/audio/analyze` (login required): WAV/FLAC/OGG up to 25 MB, optional form field `source` = `live` or `upload`; saves a measurement session **and the recording**
- `GET /api/sessions`, `/api/sessions/latest`, `/api/sessions/{id}`, `/api/sessions/{id}/report`; `GET /api/sessions/{id}/audio` (owner only, the stored recording); `DELETE /api/sessions/{id}` (also deletes the recording)
- `GET /api/research/overview`: objective and per-component status (public)
- `GET /api/enose/status`, `/api/enose/schema`; `POST /api/enose/predict` answers 409 until a validated model is integrated
- `POST /api/sensors/reading`: the ESP32 sends JSON such as `{"mq135":0,"mq7":0,"mq2":0,"temperature":0,"humidity":0}`. Every field is optional (send only the sensors that work). Non-finite or out-of-range values (temperature -40 to 80 degC, humidity 0 to 100 %) are rejected with 422
- `GET /api/sensors/status`: `receiving_data` (valid reading within 10 s), `connected` (heard within 60 s), `disconnected`, or `error` (the last post was rejected); `GET /api/sensors/latest`, `/api/sensors/history`
- `GET /api/results`: stored held-out metrics of the wheeze and crackle models

Sensor readings are kept in memory (lost on restart) and are not yet linked to user sessions.
The audio models are the ones in `models/audio_model/`; feature extraction (`services/audio_processing.py`) is unchanged.
If analysis reports a model-loading error, install the scikit-learn version used for training or re-run `training/train_audio.py`.
Research prototype. Not a diagnostic tool.

## Adding the electronic-nose model
Collect data in the format of `backend/enose/dataset_template.csv` into `datasets/enose/`, then `python training/train_enose.py --data ../datasets/enose --save-model`. See `backend/models/enose_model/README.md`.
