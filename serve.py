#!/usr/bin/env python3
"""Static server for local preview: python3 serve.py [port]

Binds to localhost. To reach it from a phone on the same network:
    HOST=0.0.0.0 python3 serve.py
then browse to http://<this machine's LAN IP>:4321
"""
import functools, os, socketserver, sys
from http.server import SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
HOST = os.environ.get("HOST", "127.0.0.1")

class Server(socketserver.TCPServer):
    allow_reuse_address = True

with Server((HOST, PORT), functools.partial(SimpleHTTPRequestHandler, directory=ROOT)) as httpd:
    print("serving %s on http://%s:%d" % (ROOT, HOST, PORT), flush=True)
    httpd.serve_forever()
