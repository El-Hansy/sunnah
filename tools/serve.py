#!/usr/bin/env python3
"""
سيرفر تطوير لموقع سُنّة.

ليه مش python3 -m http.server؟
  ١) مش بيبعت هيدرز منع التخزين، فالمتصفّح بيفضل ماسك نسخة قديمة من
     data/*.js — تعدّل ومتشوفش التعديل.
  ٢) لو البورت مشغول بيقع بخطأ وخلاص. ده بيدوّر على أول بورت فاضي.

الاستخدام:
    python3 tools/serve.py            # بورت 4173 (أو أول فاضي بعده)
    python3 tools/serve.py 8080       # بورت معيّن
    python3 tools/serve.py --no-open  # من غير ما يفتح المتصفّح
"""
import os
import sys
import socket
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRIES = 20


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # نسكت عن الطلبات العادية، ونبيّن الأخطاء بس (404 وخلافه)
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


def port_busy(port):
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    want_open = "--no-open" not in sys.argv
    start = int(args[0]) if args else 4173

    httpd = None
    port = start
    for port in range(start, start + TRIES):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler)
            break
        except OSError:
            if port_busy(port):
                print(f"البورت {port} مشغول — بجرّب اللي بعده…", flush=True)
            continue

    if httpd is None:
        print(f"مفيش بورت فاضي من {start} لـ {start + TRIES - 1}.", flush=True)
        print("جرّب بورت تاني:  python3 tools/serve.py 8080", flush=True)
        return 1

    url = f"http://localhost:{port}"
    if port != start:
        print(f"\n⚠️  البورت {start} كان مشغول، فشغّلت على {port} بدالُه.", flush=True)
    print(f"\n  سُنّة شغّال على:  {url}", flush=True)
    print("  اقفل الشباك ده أو دوس Ctrl+C لما تخلص.\n", flush=True)

    if want_open:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nاتقفل.", flush=True)
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
