#!/usr/bin/env python3
"""Run this on the PC / Codespace BEFORE building:  python3 tools/check_so.py /path/libminecraftpe.so
Prints the 4 bytes found at every patch site. All lines must say OK, otherwise this Minecraft
version is not the one the offsets were taken from (the mod would refuse to patch anyway)."""
import struct, sys

SITES = [  # (name, offset, expected little-endian word)
    ("guard  mov w1,#5",            0x1088d3e8, 0x528000A1),
    ("guard  mov w1,#5",            0x1088d7b8, 0x528000A1),
    ("water_delay (a) mov w26,#5",  0x1088d3ec, 0x528000BA),
    ("water_delay (b) mov w26,#5",  0x1088d7bc, 0x528000BA),
    ("lava overworld  mov w8,#30",  0x1088d7ec, 0x528003C8),
    ("lava nether     mov w9,#10",  0x1088d7f4, 0x52800149),
    ("sources         cmp w8,#2",   0x1088d990, 0x7100091F),
]

def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    ok_all = True
    with open(sys.argv[1], "rb") as f:
        for name, off, want in SITES:
            f.seek(off)
            raw = f.read(4)
            got = struct.unpack("<I", raw)[0] if len(raw) == 4 else None
            ok = got == want
            ok_all &= ok
            shown = " ".join("%02X" % b for b in raw) if raw else "(past end of file)"
            print(f"{'OK  ' if ok else 'BAD '} {name:30s} @0x{off:x}  found {shown}  expected "
                  + " ".join("%02X" % b for b in struct.pack("<I", want)))
    print("\nALL OK - this build matches." if ok_all else "\nMISMATCH - different Minecraft version, do not use these offsets.")
    sys.exit(0 if ok_all else 1)

main()
