#!/usr/bin/env python3
"""Re-captures the three storyboard frames after the UI change (score removed).

Uses the same Xvfb + CDP setup that fixed the video recording: window focus for
real hover events, window origin for pointer coordinates, Page.captureScreenshot
for crisp 2x stills (the flaky part earlier was the harness wrapper, not CDP).
"""
import base64
import json
import os
import shutil
import signal
import subprocess
import time
import urllib.request
from pathlib import Path

import websocket

CHROME = "/home/ubuntu/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome"
EXT = "/home/ubuntu/projects/cekdulu"
FRAMES = Path("/home/ubuntu/projects/cekdulu/demo/frames")
PORT, DISPLAY = 9230, ":90"
W, H = 1180, 740
SW, SH = 1220, 800
BASE = "file:///home/ubuntu/projects/cekdulu/demo/"


def spawn(cmd, env=None):
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)


def wait_http(url, t=25):
    t0 = time.time()
    while time.time() - t0 < t:
        try:
            with urllib.request.urlopen(url, timeout=1) as r:
                return json.loads(r.read())
        except Exception:
            time.sleep(0.25)
    raise RuntimeError(url)


class CDP:
    def __init__(self, u):
        self.ws = websocket.create_connection(u, max_size=64 << 20)
        self.ws.settimeout(0.005)
        self.mid = 0
        self.res = {}

    def _pump(self):
        try:
            raw = self.ws.recv()
        except Exception:
            return
        if not raw:
            return
        try:
            m = json.loads(raw)
        except Exception:
            return
        if "id" in m:
            self.res[m["id"]] = m

    def call(self, method, timeout=20, **p):
        self.mid += 1
        mid = self.mid
        self.ws.send(json.dumps({"id": mid, "method": method, "params": p}))
        t0 = time.time()
        while time.time() - t0 < timeout:
            self._pump()
            if mid in self.res:
                r = self.res.pop(mid)
                if "error" in r:
                    raise RuntimeError(f"{method}: {r['error']}")
                return r.get("result", {})
            time.sleep(0.002)
        raise RuntimeError(method + " timeout")

    def ev(self, e):
        return self.call("Runtime.evaluate", expression=e, returnByValue=True).get("result", {}).get("value")

    def shot(self, path):
        r = self.call("Page.captureScreenshot", format="png", captureBeyondViewport=False, timeout=40)
        Path(path).write_bytes(base64.b64decode(r["data"]))
        print("  ->", path, Path(path).stat().st_size, "bytes")

    def hold(self, s):
        t0 = time.time()
        while time.time() - t0 < s:
            self._pump()
            time.sleep(0.005)


def main():
    FRAMES.mkdir(parents=True, exist_ok=True)
    xvfb = spawn(["Xvfb", DISPLAY, "-screen", "0", f"{SW}x{SH}x24", "-nolisten", "tcp"])
    time.sleep(1.2)
    shutil.rmtree("/tmp/cekdulu-shots", ignore_errors=True)
    env = dict(os.environ, DISPLAY=DISPLAY)

    chrome = spawn([
        CHROME, "--user-data-dir=/tmp/cekdulu-shots",
        "--no-sandbox", "--no-first-run", "--no-default-browser-check",
        "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars",
        "--test-type", "--disable-infobars",
        f"--load-extension={EXT}", f"--disable-extensions-except={EXT}",
        f"--remote-debugging-port={PORT}", "--remote-allow-origins=*",
        "--kiosk", f"--window-size={W},{H}", "about:blank",
    ], env=env)

    def xdo(*a):
        subprocess.run(["xdotool", *a], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        wait_http(f"http://127.0.0.1:{PORT}/json/version")
        time.sleep(2.4)
        tg = wait_http(f"http://127.0.0.1:{PORT}/json/list")
        page = next(t for t in tg if t["type"] == "page")
        c = CDP(page["webSocketDebuggerUrl"])
        c.call("Runtime.enable")
        c.call("Page.enable")

        # focus once
        xdo("mousemove", "600", "400")
        time.sleep(0.3)
        loc = subprocess.run(["xdotool", "getmouselocation"], env=env,
                             capture_output=True, text=True).stdout.strip()
        wid = loc.split("window:")[1].split()[0]
        xdo("windowfocus", wid)
        time.sleep(0.4)
        geo = subprocess.run(["xdotool", "getwindowgeometry", "--shell", wid], env=env,
                             capture_output=True, text=True).stdout
        vals = dict(l.split("=") for l in geo.strip().splitlines() if "=" in l)
        ox, oy = int(vals.get("X", 0)), int(vals.get("Y", 0))
        print("window at", ox, oy)

        def load(fn):
            c.call("Emulation.setDeviceMetricsOverride", width=W, height=H,
                   deviceScaleFactor=2, mobile=False)
            c.call("Page.navigate", url=BASE + fn, timeout=25)
            for _ in range(80):
                if c.ev("document.readyState") == "complete":
                    break
                c.hold(0.1)
            c.hold(1.0)

        def rect(id_):
            return json.loads(c.ev(
                f"""(() => {{ const r = document.getElementById('{id_}').getBoundingClientRect();
                     return JSON.stringify({{x: r.x + r.width*0.5, y: r.y + r.height/2}}); }})()"""))

        def hover(p):
            xdo("mousemove", str(int(p["x"] + ox - 40)), str(int(p["y"] + oy)))
            time.sleep(0.15)
            xdo("mousemove", str(int(p["x"] + ox)), str(int(p["y"] + oy)))
            c.hold(0.8)

        # ---- 01 hover, whatssapp
        print("frame 01")
        load("f1-whatsapp.html")
        hover(rect("target"))
        c.shot(FRAMES / "01-hover.png")

        # ---- 02 block card
        print("frame 02")
        xdo("mousedown", "1"); time.sleep(0.06); xdo("mouseup", "1")
        c.hold(0.9)
        c.shot(FRAMES / "02-block.png")

        # ---- 03 amber on a normal site
        print("frame 03")
        load("f2-article.html")
        hover(rect("target"))
        c.shot(FRAMES / "03-warn.png")

        # ---- 04 popup (paste checker)
        print("frame 04")
        c.call("Emulation.setDeviceMetricsOverride", width=372, height=460,
               deviceScaleFactor=2, mobile=False)
        c.call("Page.navigate", url=BASE + "f3-popup.html", timeout=25)
        for _ in range(80):
            if c.ev("document.readyState") == "complete":
                break
            c.hold(0.1)
        c.hold(1.6)
        c.shot(FRAMES / "04-popup.png")

        # trim the empty tail so the cell does not look hollow
        from PIL import Image
        im = Image.open(FRAMES / "04-popup.png").convert("RGB")
        bg = im.getpixel((5, im.height - 5))
        last = im.height
        for y in range(im.height - 1, 0, -1):
            row = [im.getpixel((x, y)) for x in range(0, im.width, 9)]
            if any(abs(p[0]-bg[0]) + abs(p[1]-bg[1]) + abs(p[2]-bg[2]) > 18 for p in row):
                last = min(im.height, y + 28)
                break
        im.crop((0, 0, im.width, last)).save(FRAMES / "04-popup.png")
        print("  cropped popup to", im.width, last)

        print("done")
    finally:
        for p in (chrome, xvfb):
            try:
                p.send_signal(signal.SIGTERM)
            except Exception:
                pass


if __name__ == "__main__":
    main()
