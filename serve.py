#!/usr/bin/env python3
"""Static server for local preview: python3 serve.py [port]

Binds to localhost. To reach it from a phone on the same network:
    HOST=0.0.0.0 python3 serve.py
then browse to http://<this machine's LAN IP>:4321

Every response is sent with Cache-Control: no-store, so a browser never shows
an earlier stylesheet or script after a change.
"""
import functools, os, re, socketserver, sys
from http.server import SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
HOST = os.environ.get("HOST", "127.0.0.1")

class Handler(SimpleHTTPRequestHandler):
    # Safari only plays video from a server that answers byte-range requests,
    # so a Range header on a file gets a 206 with just that slice.
    def send_head(self):
        path = self.translate_path(self.path)
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        if not match or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        first, last = match.groups()
        if first:
            start, end = int(first), min(int(last), size - 1) if last else size - 1
        elif last:
            start, end = max(size - int(last), 0), size - 1
        else:
            return super().send_head()
        if start > end or start >= size:
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        self._remaining = None
        while remaining > 0:
            chunk = source.read(min(remaining, 64 * 1024))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(socketserver.TCPServer):
    allow_reuse_address = True

with Server((HOST, PORT), functools.partial(Handler, directory=ROOT)) as httpd:
    print("serving %s on http://%s:%d" % (ROOT, HOST, PORT), flush=True)
    httpd.serve_forever()
