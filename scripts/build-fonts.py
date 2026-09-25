#!/usr/bin/env python3
"""Subsets the two variable fonts to Latin and writes woff2 into public/assets/fonts.
Rerunnable. Keeps the wght axis intact (Big Shoulders Display 100 to 900, Manrope 200 to 800)
and the tnum feature Manrope's figures use."""
import subprocess, os, sys
SRC = "/home/claude/savebrew/assets/fonts"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "assets", "fonts")
os.makedirs(OUT, exist_ok=True)
# Latin, Latin-1 Supplement, Latin Extended-A, general punctuation, currency, arrows used in the UI, and the tabular figures
UNICODES = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
for src, out in (("BigShouldersDisplay[wght].ttf", "big-shoulders-display-latin.woff2"), ("Manrope[wght].ttf", "manrope-latin.woff2")):
    cmd = ["pyftsubset", os.path.join(SRC, src), f"--unicodes={UNICODES}", "--flavor=woff2",
           "--layout-features=*", "--no-hinting", "--desubroutinize", f"--output-file={os.path.join(OUT, out)}"]
    subprocess.run(cmd, check=True)
    print(out, os.path.getsize(os.path.join(OUT, out)), "bytes")
