#!/usr/bin/env python3
"""
سيرفر تطوير لموقع سُنّة — شغّال على كل الشبكة المحلية.

ليه مش python3 -m http.server؟
  ١) مش بيبعت هيدرز منع التخزين، فالمتصفّح بيفضل ماسك نسخة قديمة من
     data/*.js — تعدّل ومتشوفش التعديل.
  ٢) لو البورت مشغول بيقع بخطأ وخلاص. ده بيدوّر على أول بورت فاضي.
  ٣) ده بيطبع لك عنوان الجهاز على الواي فاي، عشان تفتحه من الآيباد
     أو أي موبايل في البيت على طول.

الاستخدام:
    python3 tools/serve.py              # متاح لكل أجهزة الواي فاي
    python3 tools/serve.py --local      # على الماك بس
    python3 tools/serve.py 8080         # بورت معيّن
    python3 tools/serve.py --no-open    # من غير ما يفتح المتصفّح
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


def lan_ips():
    """عناوين الجهاز على الشبكة المحلية (من غير 127.x)."""
    found = []

    # الطريقة الأضمن: نفتح سوكيت وهمي ونشوف العنوان اللي اتختار
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.settimeout(0.3)
            s.connect(("8.8.8.8", 80))     # مش بيبعت أي داتا فعلاً
            found.append(s.getsockname()[0])
    except OSError:
        pass

    # واحتياطي: كل العناوين المرتبطة باسم الجهاز
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in found:
                found.append(ip)
    except OSError:
        pass

    return found


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    want_open = "--no-open" not in sys.argv
    local_only = "--local" in sys.argv
    start = int(args[0]) if args else 4173

    # "" = كل الواجهات (الواي فاي كمان) · "127.0.0.1" = الماك بس
    host = "127.0.0.1" if local_only else ""

    httpd = None
    port = start
    for port in range(start, start + TRIES):
        try:
            httpd = ThreadingHTTPServer((host, port), NoCacheHandler)
            break
        except OSError:
            if port_busy(port):
                print(f"البورت {port} مشغول — بجرّب اللي بعده…", flush=True)
            continue

    if httpd is None:
        print(f"مفيش بورت فاضي من {start} لـ {start + TRIES - 1}.", flush=True)
        print("جرّب بورت تاني:  python3 tools/serve.py 8080", flush=True)
        return 1

    if port != start:
        print(f"\n⚠️  البورت {start} كان مشغول، فشغّلت على {port} بدالُه.", flush=True)

    local_url = f"http://localhost:{port}"
    print(f"\n  على الماك ده:   {local_url}", flush=True)

    if local_only:
        print("\n  (شغّال على الماك بس — شيل --local عشان يبقى متاح على الواي فاي)", flush=True)
    else:
        ips = lan_ips()
        if ips:
            print("\n  من الآيباد أو الموبايل — اكتب ده في المتصفّح:", flush=True)
            for ip in ips:
                print(f"\n      http://{ip}:{port}", flush=True)
            print("\n  (لازم يكونوا على نفس شبكة الواي فاي)", flush=True)
            print("  أي حد على الشبكة دي يقدر يفتحه. للماك بس: --local", flush=True)
        else:
            print("\n  مش لاقي عنوان على الشبكة — يمكن الواي فاي مقفول؟", flush=True)

    print("\n  اقفل الشباك ده أو دوس Ctrl+C لما تخلص.\n", flush=True)

    if want_open:
        threading.Timer(0.8, lambda: webbrowser.open(local_url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nاتقفل.", flush=True)
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
