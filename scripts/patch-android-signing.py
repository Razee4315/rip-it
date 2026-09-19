#!/usr/bin/env python3
"""Patch Tauri-generated app/build.gradle.kts with release signingConfig."""
from __future__ import annotations

import pathlib
import re
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: patch-android-signing.py <app/build.gradle.kts>", file=sys.stderr)
        return 2
    path = pathlib.Path(sys.argv[1])
    src = path.read_text()

    signing_block = """
    signingConfigs {
        create("release") {
            val ksProps = Properties()
            val ksFile = rootProject.file("keystore.properties")
            if (ksFile.exists()) {
                ksFile.inputStream().use { ksProps.load(it) }
                keyAlias = ksProps.getProperty("keyAlias")
                keyPassword = ksProps.getProperty("keyPassword")
                storeFile = file(ksProps.getProperty("storeFile"))
                storePassword = ksProps.getProperty("storePassword")
            }
        }
    }
"""

    if "create(\"release\")" not in src or "signingConfigs" not in src:
        m = re.search(r"android\s*\{", src)
        if not m:
            print("no android { block", file=sys.stderr)
            return 1
        src = src[: m.end()] + "\n" + signing_block + src[m.end() :]

    release_sig = (
        'signingConfig = if (rootProject.file("keystore.properties").exists()) '
        'signingConfigs.getByName("release") else signingConfigs.getByName("debug")'
    )
    if "signingConfig =" not in src:
        m = re.search(r'getByName\("release"\)\s*\{', src)
        if not m:
            print('no getByName("release") block', file=sys.stderr)
            return 1
        src = src[: m.end()] + "\n        " + release_sig + "\n" + src[m.end() :]

    path.write_text(src)
    print(f"patched {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
