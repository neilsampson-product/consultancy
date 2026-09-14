#!/usr/bin/env python3
"""Static server for local preview: python3 serve.py [port]"""
import functools, os, socketserver, sys
from http.server import SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4321

class Server(socketserver.TCPServer):
    allow_reuse_address = True

with Server(("127.0.0.1", PORT), functools.partial(SimpleHTTPRequestHandler, directory=ROOT)) as httpd:
    print("serving %s on http://127.0.0.1:%d" % (ROOT, PORT), flush=True)
    httpd.serve_forever()
