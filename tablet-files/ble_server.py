"""
FRC//DC  —  USB/ADB Data Server
──────────────────────────────────────────────────────────────────
Setup (once):
    adb reverse tcp:5175 tcp:5175

Run:
    python server.py
    python server.py --watch
──────────────────────────────────────────────────────────────────
"""

import sys
import json
import time
import threading
import socket
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

DATA_FILE  = Path(__file__).parent / "../Data/picklist_2026ksla.json"
PORT       = 5175
WATCH_MODE = "--watch" in sys.argv

data_json = ""

def load_data():
    global data_json
    try:
        if not DATA_FILE.exists():
            DATA_FILE.write_text('{"status": "waiting for data"}')
        raw = DATA_FILE.read_text(encoding="utf-8")
        json.loads(raw)
        data_json = raw
        print(f"[DATA] Loaded {len(data_json):,} bytes")
        return True
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/data":
            body = data_json.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        print(f"[HTTP] {args[0]} {args[1]}")

def watch_file():
    last = DATA_FILE.stat().st_mtime if DATA_FILE.exists() else 0
    while True:
        time.sleep(1)
        try:
            mtime = DATA_FILE.stat().st_mtime
            if mtime != last:
                last = mtime
                time.sleep(0.3)
                load_data()
                print("[DATA] Reloaded ✓")
        except Exception:
            pass

if __name__ == "__main__":
    if not load_data():
        sys.exit(1)

    if WATCH_MODE:
        threading.Thread(target=watch_file, daemon=True).start()
        print("[DATA] Watching data.json for changes")

    httpd = HTTPServer(("127.0.0.1", PORT), Handler)

    print("──────────────────────────────────────────────────────")
    print("  FRC//DC  USB Server  — Running")
    print(f"  URL        : http://localhost:{PORT}/data")
    print(f"  Data file  : {DATA_FILE}")
    print(f"  Watch mode : {WATCH_MODE}")
    print("──────────────────────────────────────────────────────")
    print("  Checklist:")
    print("  1. Tablet plugged in via USB")
    print("  2. adb reverse tcp:5175 tcp:5175  (run once per cable plug-in)")
    print("  3. Tap USB Sync in the app")
    print("──────────────────────────────────────────────────────")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[HTTP] Stopped.")