"""Tiny local helper: receives {name, data: dataURL} via POST and writes PNG files into OUT_DIR.
Only listens on 127.0.0.1, only accepts safe file names, only writes .png."""
import base64, json, os, re, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

OUT_DIR = sys.argv[1]
os.makedirs(OUT_DIR, exist_ok=True)


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:8765')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'png saver ok')

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(n))
        name = body.get('name', '')
        if not re.fullmatch(r'[A-Za-z0-9_\-]{1,80}', name):
            self.send_response(400); self._cors(); self.end_headers(); return
        data = body.get('data', '').split(',', 1)[-1]
        with open(os.path.join(OUT_DIR, name + '.png'), 'wb') as f:
            f.write(base64.b64decode(data))
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')

    def log_message(self, *a):
        pass


HTTPServer(('127.0.0.1', 8766), H).serve_forever()
