"""CV Builder - browser tests.

Runs its own server, so it needs nothing else running:
    python3 tests/ui_test.py

Checks the page loads with no errors, draws a CV, survives a reload, switches
layout, language, paper and theme, exports and re-opens a copy, refuses a bad
file, and never makes a request to anywhere else.
"""
from __future__ import annotations

import http.server
import json
import socket
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CHECKS = 0
FAILED = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global CHECKS, FAILED
    CHECKS += 1
    if not condition:
        FAILED += 1
        print(f"FAIL: {name} {detail}")


def free_port() -> int:
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def serve(port: int) -> socketserver.TCPServer:
    handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(
        *args, directory=str(ROOT), **kwargs
    )
    server = socketserver.TCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main() -> int:
    port = free_port()
    serve(port)
    base = f"http://127.0.0.1:{port}/"

    with sync_playwright() as play:
        browser = play.chromium.launch()
        context = browser.new_context(viewport={"width": 1440, "height": 950}, accept_downloads=True)
        page = context.new_page()

        dialogs: list[str] = []
        page.on("dialog", lambda dialog: (dialogs.append(dialog.message), dialog.accept()))

        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        foreign: list[str] = []
        page.on("request", lambda request: foreign.append(request.url) if not request.url.startswith(base) else None)

        page.goto(base, wait_until="load")
        page.wait_for_timeout(500)

        check("loads on a blank CV with no errors", not errors, str(errors))
        check("no request leaves the page", not foreign, str(foreign))
        check("the empty page shows the placeholder", "name appears here" in page.inner_text("#paper"))

        # the example
        page.click("#btn-sample")
        page.wait_for_timeout(400)
        paper = page.inner_text("#paper")
        check("the example fills the page", "Ana Petrović" in paper)
        check("experience prints with dates", "Mar 2022" in paper and "Present" in paper)
        check("bullets came out of the text box", page.locator("#paper .doc-list li").count() >= 4,
              str(page.locator("#paper .doc-list li").count()))
        check("page count is reported", page.inner_text("#pages").startswith("1"))

        # typing into the form redraws the page
        page.fill("#p-name", "Marko Marković")
        page.wait_for_timeout(200)
        check("typing a name redraws the page", "Marko Marković" in page.inner_text("#paper"))

        # a new job can be added and removed
        before = page.locator(".entry").count()
        page.click("#add-exp")
        page.wait_for_timeout(200)
        check("a job can be added", page.locator("[data-list='experience']").count() > 0)
        page.fill("[data-list='experience'][data-index='2'][data-field='role']", "Intern")
        page.wait_for_timeout(200)
        check("a new job reaches the page", "Intern" in page.inner_text("#paper"))
        page.locator("[data-remove='experience'][data-index='2']").click()
        page.wait_for_timeout(200)
        check("a job can be removed", "Intern" not in page.inner_text("#paper"))
        check("the form keeps the other jobs", page.locator(".entry").count() == before)

        # layouts
        for template, marker in (("column", "side"), ("banner", "band"), ("classic", "doc-head")):
            page.select_option("#o-template", template)
            page.wait_for_timeout(250)
            check(f"{template} layout draws", page.locator(f"#paper .{marker}").count() >= 1)
        check("the classic layout has no side column", page.locator("#paper .side").count() == 0)

        # language of the document
        page.select_option("#o-doclang", "sr-cyrl")
        page.wait_for_timeout(250)
        cyr = page.inner_text("#paper")
        check("document headings follow the chosen language", "ПРОФИЛ" in cyr and "ИСКУСТВО" in cyr.upper(), cyr[:80])
        check("present is translated", "Данас" in cyr)
        page.select_option("#o-doclang", "ro")
        page.wait_for_timeout(250)
        check("romanian headings", "EXPERIENȚĂ" in page.inner_text("#paper").upper())
        page.select_option("#o-doclang", "en")
        page.wait_for_timeout(200)

        # interface language
        page.select_option("#lang", "ro")
        page.wait_for_timeout(250)
        check("interface in romanian", "fără plată" in page.inner_text("h1"), page.inner_text("h1"))
        check("html lang follows", page.get_attribute("html", "lang") == "ro")
        page.select_option("#lang", "sr-cyrl")
        page.wait_for_timeout(250)
        heading = page.inner_text("h1")
        check("cyrillic interface", any("\u0400" <= char <= "\u04ff" for char in heading), heading)
        page.select_option("#lang", "en")
        page.wait_for_timeout(250)

        # paper and typeface
        page.select_option("#o-page", "letter")
        page.wait_for_timeout(250)
        width = page.eval_on_selector("#paper", "el => el.offsetWidth")
        check("letter is wider than A4", width == round(216 * 96 / 25.4), str(width))
        page.select_option("#o-page", "a4")
        page.wait_for_timeout(200)
        page.select_option("#o-font", "serif")
        page.wait_for_timeout(200)
        check("serif class applied", "serif" in page.get_attribute("#paper", "class"))
        page.select_option("#o-font", "sans")
        page.wait_for_timeout(200)

        # accent
        page.click(".swatch[data-accent='#1f6f5c']")
        page.wait_for_timeout(200)
        check("accent reaches the page", page.eval_on_selector("#paper", "el => el.style.getPropertyValue('--acc')") == "#1f6f5c")

        # reload keeps the work
        page.reload(wait_until="load")
        page.wait_for_timeout(600)
        check("the CV survives a reload", "Marko Marković" in page.inner_text("#paper"))
        check("the accent survives a reload", page.eval_on_selector("#paper", "el => el.style.getPropertyValue('--acc')") == "#1f6f5c")

        # theme
        page.click("#theme")
        page.wait_for_timeout(200)
        check("dark theme applied", page.get_attribute("html", "data-theme") == "dark")
        check("the paper stays white in the dark theme", page.eval_on_selector("#paper", "el => getComputedStyle(el).backgroundColor") == "rgb(255, 255, 255)")
        page.click("#theme")
        page.wait_for_timeout(200)

        # export a copy, then read it back
        with page.expect_download() as caught:
            page.click("#btn-json")
        download = caught.value
        exported = Path(download.path())
        check("a copy downloads as json", exported.exists() and download.suggested_filename == "cv-marko-markovic.json", download.suggested_filename)
        data = json.loads(exported.read_text(encoding="utf-8"))
        check("the copy holds the typed name", data["person"]["name"] == "Marko Marković")

        page.click("#btn-clear")
        page.wait_for_timeout(400)
        check("a confirmed clear empties the page", "name appears here" in page.inner_text("#paper"))

        page.set_input_files("#import-json", str(exported))
        page.wait_for_timeout(500)
        check("a copy can be opened again", "Marko Marković" in page.inner_text("#paper"))

        # a wrong file is refused
        junk = ROOT / "tests" / "not-a-cv.json"
        junk.write_text('{"hello": "world"}', encoding="utf-8")
        before_dialogs = len(dialogs)
        page.set_input_files("#import-json", str(junk))
        page.wait_for_timeout(400)
        check("a wrong file is refused with a message", len(dialogs) > before_dialogs, str(dialogs))
        check("a wrong file does not wipe the CV", "Marko Marković" in page.inner_text("#paper"))
        junk.unlink()

        # the print stylesheet keeps the paper and drops the editor
        page.emulate_media(media="print")
        check("the editor steps aside when printing", not page.locator(".editor").is_visible())
        check("the paper is visible when printing", page.locator("#paper").is_visible())
        check("the paper is not scaled when printing", page.eval_on_selector("#paper", "el => getComputedStyle(el).transform") in ("none", "matrix(1, 0, 0, 1, 0, 0)"))
        page.emulate_media(media="screen")

        # offline shell
        page.wait_for_timeout(700)
        registered = page.evaluate("navigator.serviceWorker.getRegistrations().then(r => r.length)")
        check("service worker registered", registered >= 1, str(registered))

        browser.close()

    print(("PASS: " if not FAILED else "FAIL: ") + f"{CHECKS - FAILED} of {CHECKS} browser checks")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
