#!/usr/bin/env python3
"""Records the walkthrough with a REAL X pointer (xdotool) + ffmpeg x11grab.

Why xdotool: CDP Input.dispatchMouseEvent injects events into the renderer but does
not move the X cursor, so the recorded arrow stayed behind while the tooltip appeared
at the injected coordinates — the demo looked broken. Driving the actual pointer means
the hover, the click and the tooltip position all come from one real event stream.
"""
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
PAGE = "file:///home/ubuntu/projects/cekdulu/demo/f1-whatsapp.html"
OUT = Path("/home/ubuntu/projects/cekdulu/demo/rec")
PORT = 9229
DISPLAY = ":92"
W, H = 1180, 740
SW, SH = 1220, 800


def spawn(cmd, env=None):
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)


def wait_http(url, timeout=25):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1) as r:
                return json.loads(r.read())
        except Exception:
            time.sleep(0.25)
    raise RuntimeError("timeout waiting for " + url)


class CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, max_size=8 * 1024 * 1024)
        self.ws.settimeout(0.004)
        self.mid = 0
        self.results = {}

    def _pump(self):
        try:
            raw = self.ws.recv()
        except Exception:
            return
        if raw:
            try:
                m = json.loads(raw)
            except Exception:
                return
            if "id" in m:
                self.results[m["id"]] = m

    def call(self, method, timeout=12, **params):
        self.mid += 1
        mid = self.mid
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        t0 = time.time()
        while time.time() - t0 < timeout:
            self._pump()
            if mid in self.results:
                r = self.results.pop(mid)
                if "error" in r:
                    raise RuntimeError(f"{method}: {r['error']}")
                return r.get("result", {})
            time.sleep(0.002)
        raise RuntimeError(f"{method} timed out")

    def eval(self, expr):
        return self.call("Runtime.evaluate", expression=expr, returnByValue=True).get("result", {}).get("value")

    def hold(self, s):
        t0 = time.time()
        while time.time() - t0 < s:
            self._pump()
            time.sleep(0.005)


class Mouse:
    def __init__(self, env):
        self.env = env
        self.x, self.y = 200, 640
        self.ox, self.oy = 0, 0

    def _run(self, *args):
        subprocess.run(["xdotool", *args], env=self.env,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)

    def move_to(self, x, y, dur=0.8):
        x += self.ox
        y += self.oy
        x0, y0 = self.x, self.y
        steps = max(10, int(dur * 45))
        t0 = time.time()
        for i in range(1, steps + 1):
            t = i / steps
            e = t * t * (3 - 2 * t)
            px, py = x0 + (x - x0) * e, y0 + (y - y0) * e
            self._run("mousemove", str(int(px)), str(int(py)))
            target = t0 + dur * t
            while time.time() < target:
                time.sleep(0.001)
        self._run("mousemove", str(int(x)), str(int(y)))
        self.x, self.y = x, y

    def focus_and_locate(self):
        """Without a window manager the toplevel never gets input focus and Chrome
        ignores X motion events (pointer moves, :hover does not). And the window sits
        at (10,10), so page coords != screen coords."""
        loc = subprocess.run(["xdotool", "getmouselocation"], env=self.env,
                             capture_output=True, text=True).stdout.strip()
        wid = loc.split("window:")[1].split()[0]
        subprocess.run(["xdotool", "windowfocus", wid], env=self.env,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(0.35)
        geo = subprocess.run(["xdotool", "getwindowgeometry", "--shell", wid], env=self.env,
                             capture_output=True, text=True).stdout
        vals = dict(l.split("=") for l in geo.strip().splitlines() if "=" in l)
        self.ox, self.oy = int(vals.get("X", 0)), int(vals.get("Y", 0))
        return wid, self.ox, self.oy

    def click(self):
        self._run("mousedown", "1")
        time.sleep(0.06)
        self._run("mouseup", "1")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    raw = OUT / "real.mp4"
    if raw.exists():
        raw.unlink()

    xvfb = spawn(["Xvfb", DISPLAY, "-screen", "0", f"{SW}x{SH}x24", "-nolisten", "tcp"])
    time.sleep(1.2)

    profile = "/tmp/cekdulu-real"
    shutil.rmtree(profile, ignore_errors=True)
    env = dict(os.environ, DISPLAY=DISPLAY)

    chrome = spawn([
        CHROME, f"--user-data-dir={profile}",
        "--no-sandbox", "--no-first-run", "--no-default-browser-check",
        "--disable-gpu", "--disable-dev-shm-usage",
        "--disable-features=Translate,MediaRouter,GlobalMediaControls",
        "--hide-scrollbars", "--force-device-scale-factor=1",
        "--test-type", "--disable-infobars",
        "--exclude-switches=enable-automation",
        f"--load-extension={EXT}", f"--disable-extensions-except={EXT}",
        f"--remote-debugging-port={PORT}", "--remote-allow-origins=*",
        "--kiosk", "--window-size=%d,%d" % (W, H), PAGE,
    ], env=env)

    ffmpeg = None
    try:
        wait_http(f"http://127.0.0.1:{PORT}/json/version")
        time.sleep(2.4)

        targets = wait_http(f"http://127.0.0.1:{PORT}/json/list")
        ext = [t["url"] for t in targets if "src/background" in t["url"]]
        print("extension service worker:", ext or "NOT FOUND")
        page = next(t for t in targets if t["type"] == "page")
        c = CDP(page["webSocketDebuggerUrl"])
        c.call("Runtime.enable")
        c.call("Page.navigate", url=PAGE, timeout=20)
        for _ in range(80):
            if c.eval("document.readyState") == "complete":
                break
            c.hold(0.1)
        c.hold(1.2)

        geo = json.loads(c.eval("""(() => {
          const a = document.getElementById('target'), b = document.getElementById('target2');
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          return JSON.stringify({
            bad:  {x: ra.x + ra.width*0.45, y: ra.y + ra.height/2},
            safe: {x: rb.x + rb.width*0.5,  y: rb.y + rb.height/2},
            vh: innerHeight, vw: innerWidth
          });
        })()"""))
        

        m = Mouse(env)
        m.move_to(600, 400, dur=0.02)
        wid, ox, oy = m.focus_and_locate()
        print(f"window {wid} at ({ox},{oy}) targets:", geo)
        m.move_to(240, 640, dur=0.02)
        c.hold(0.5)

        fflog = open("/tmp/ffmpeg.log", "w")
        ffmpeg = subprocess.Popen([
            "ffmpeg", "-y", "-loglevel", "info",
            "-f", "x11grab", "-framerate", "30", "-draw_mouse", "1",
            "-video_size", f"{W}x{H}", "-i", f"{DISPLAY}.0+{ox},{oy}",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "16", "-pix_fmt", "yuv420p",
            str(raw),
        ], env=env, stdout=fflog, stderr=fflog)
        time.sleep(1.2)

        # ---------------------------------------------------- choreography --
        c.hold(0.8)
        m.move_to(geo["bad"]["x"], geo["bad"]["y"], dur=0.85)
        c.hold(1.6)                                   # pill appears, readable

        print("DIAG hover chain:", c.eval("""(()=>{const e=[...document.querySelectorAll(':hover')].map(x=>x.tagName+(x.id?'#'+x.id:''));
            return e.join(' > ');})()"""))
        print("DIAG pill:", c.eval("""(()=>{const h=document.querySelector('div[id=\"__cekdulu_host__\"]');
            if(!h) return 'no host'; const p=h.shadowRoot.getElementById('pill'); return p.className;})()"""))

        m.click()
        c.hold(3.0)                                   # card in, reasons readable
        print("DIAG overlay:", c.eval("""(()=>{const h=document.querySelector('div[id=\"__cekdulu_host__\"]');
            return h ? !!h.shadowRoot.querySelector('.overlay') : 'no host';})()"""))

        back = json.loads(c.eval("""(() => {
          const h = document.querySelector('div[id="__cekdulu_host__"]');
          const b = h && h.shadowRoot.getElementById('back');
          if (!b) return '{"x":0,"y":0}';
          const r = b.getBoundingClientRect();
          return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2});
        })()"""))
        if back["x"]:
            m.move_to(back["x"], back["y"], dur=0.5)
            c.hold(0.25)
            m.click()
            c.hold(1.0)

        m.move_to(geo["safe"]["x"], geo["safe"]["y"], dur=0.9)
        c.hold(2.0)
        c.hold(0.5)

        time.sleep(0.6)
        ffmpeg.send_signal(signal.SIGTERM)
        ffmpeg.wait(timeout=20)
        ffmpeg = None
        print(f"raw: {raw.stat().st_size/1024:.0f} KB")
        print("OFFSET", off)

    finally:
        if ffmpeg:
            try:
                ffmpeg.send_signal(signal.SIGTERM)
            except Exception:
                pass
        for p in (chrome, xvfb):
            try:
                p.send_signal(signal.SIGTERM)
            except Exception:
                pass


if __name__ == "__main__":
    main()
