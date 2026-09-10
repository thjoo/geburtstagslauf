#!/usr/bin/env python3
"""Kleiner Vorschau-Server fuer die Entwicklung.

Wie 'python3 -m http.server', aber mit abgeschaltetem Zwischenspeicher.
Sonst zeigt der Browser nach einer Aenderung weiter die alte Fassung.

    python3 tools/vorschau-server.py [Port]
"""

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class OhneZwischenspeicher(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        pass  # ruhig bleiben


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    with ThreadingHTTPServer(("127.0.0.1", port), OhneZwischenspeicher) as server:
        print(f"Vorschau auf http://localhost:{port}")
        server.serve_forever()
