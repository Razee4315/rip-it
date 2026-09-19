#!/usr/bin/env python3
"""Fail if APK is unsigned or missing arm64-v8a native lib."""
from __future__ import annotations

import sys
import zipfile


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: verify-apk-signed.py <apk>", file=sys.stderr)
        return 2
    apk = sys.argv[1]
    with zipfile.ZipFile(apk) as z:
        names = z.namelist()
    v1 = [
        n
        for n in names
        if n.startswith("META-INF/") and n.endswith((".RSA", ".DSA", ".EC"))
    ]
    data = open(apk, "rb").read()
    v2 = b"APK Sig Block 42" in data
    libs = [n for n in names if n.startswith("lib/") and n.endswith(".so")]
    print("v1_certs", v1)
    print("v2_block", v2)
    print("native_libs", libs)
    if not v1 and not v2:
        print("APK is UNSIGNED — refusing to upload", file=sys.stderr)
        return 1
    if not any("arm64-v8a" in n for n in libs):
        print("No arm64-v8a .so in APK", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
