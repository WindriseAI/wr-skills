# SPDX-License-Identifier: MIT
"""把 docs/src 下的 HTML 渲染成 docs/images 下的 PNG。

用法：python docs/wr-sunkit/src/render.py（仅维护者重出配图用，需要先装 playwright；Windows 上也可以用 py 启动器）
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

SRC = Path(__file__).resolve().parent
OUT = SRC.parent / "images"

# (源文件, 元素选择器, 输出文件名)
JOBS = [
    ("hero.html", "#card", "hero.png"),
    ("workflow.html", "#card", "workflow.png"),
    ("demos.html", "#demo-calorie", "demo-calorie.png"),
    ("demos.html", "#demo-sance", "demo-sance.png"),
    ("demos.html", "#demo-opp", "demo-opp.png"),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 900}, device_scale_factor=2)
        for src, selector, name in JOBS:
            page.goto((SRC / src).as_uri())
            page.wait_for_load_state("networkidle")
            page.locator(selector).screenshot(path=str(OUT / name))
            print("ok", name)
        browser.close()


if __name__ == "__main__":
    main()
