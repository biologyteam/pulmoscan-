"""SQLite storage for users, login sessions and measurement sessions.

One file (backend/data/pulmoscan.db). Every query that returns user data filters by user_id,
so a user can only ever read their own records.
"""
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("PULMOSCAN_DB", Path(__file__).parent / "data" / "pulmoscan.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id     TEXT NOT NULL UNIQUE,            -- shown to the user, e.g. PS-7K2M9QXA
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,                   -- scrypt, never the password
    created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_tokens (
    token_hash TEXT PRIMARY KEY,                   -- sha256 of the cookie value
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
-- One measurement session = one visit/measurement. Audio results (and, in Phase 3, gas readings) hang off it.
CREATE TABLE IF NOT EXISTS measurement_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    note       TEXT
);
CREATE TABLE IF NOT EXISTS audio_results (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       INTEGER NOT NULL REFERENCES measurement_sessions(id) ON DELETE CASCADE,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename         TEXT,
    duration_s       REAL,
    windows          INTEGER,
    truncated        INTEGER,
    wheeze_score     REAL NOT NULL,
    wheeze_threshold REAL NOT NULL,
    wheeze_detected  INTEGER NOT NULL,
    crackle_score    REAL NOT NULL,
    crackle_threshold REAL NOT NULL,
    crackle_detected INTEGER NOT NULL,
    confidence       REAL NOT NULL,
    source           TEXT NOT NULL DEFAULT 'upload',   -- 'live' (recorded in the browser from the input device) or 'upload'
    recording_file   TEXT                              -- file name inside data/recordings/<user_id>/, NULL for older sessions
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON measurement_sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audio_user ON audio_results(user_id);
"""


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, check_same_thread=False)   # one connection per request, never shared
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


# Columns added after the first release. Existing databases are upgraded in place; no data is touched.
MIGRATIONS = {"audio_results": {"source": "TEXT NOT NULL DEFAULT 'upload'", "recording_file": "TEXT"}}

RECORDINGS_DIR = DB_PATH.parent / "recordings"


def recording_path(user_id: int, filename: str) -> Path:
    """Where a session's audio lives. Built only from the integer user id and a server-made name, never from user input."""
    return RECORDINGS_DIR / str(int(user_id)) / Path(filename).name


def _migrate(con):
    for table, cols in MIGRATIONS.items():
        have = {r["name"] for r in con.execute(f"PRAGMA table_info({table})")}
        for name, ddl in cols.items():
            if name not in have:
                con.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")


def init_db():
    con = connect()
    try:
        con.execute("PRAGMA journal_mode = WAL")
        con.executescript(SCHEMA)
        _migrate(con)
        con.commit()
    finally:
        con.close()


def get_db():
    """FastAPI dependency: one connection per request."""
    con = connect()
    try:
        yield con
    finally:
        con.close()
