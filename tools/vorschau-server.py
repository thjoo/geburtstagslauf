#!/usr/bin/env python3
"""Kleiner Vorschau-Server fuer die Entwicklung.

Wie 'python3 -m http.server', aber mit abgeschaltetem Zwischenspeicher.
Sonst zeigt der Browser nach einer Aenderung weiter die alte Fassung.

    python3 tools/vorschau-server.py [Port] [--offen]

Ohne --offen hoert er nur auf diesem Rechner (127.0.0.1). Mit --offen
auch im Heimnetz, dann kommt das Handy im gleichen WLAN unter der
angezeigten Adresse dazu. Solange er so laeuft, kann jedes Geraet im
Netz den Ordner lesen, also nur fuers Ausprobieren offen lassen.
"""

import socket
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


def eigene_adresse():
    """Die Adresse dieses Rechners im Heimnetz.

    Gefragt wird ueber einen Testanschluss nach draussen; gesendet wird
    dabei nichts, es geht nur darum, welche der Netzwerkkarten das
    Betriebssystem dafuer nehmen wuerde.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("192.0.2.1", 1))   # Adresse aus dem Testbereich
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    offen = "--offen" in sys.argv
    port = int(args[0]) if args else 8000

    with ThreadingHTTPServer(
        ("0.0.0.0" if offen else "127.0.0.1", port), OhneZwischenspeicher
    ) as server:
        print(f"Vorschau auf http://localhost:{port}")
        if offen:
            print(f"Im Heimnetz auf http://{eigene_adresse()}:{port}")
        server.serve_forever()
