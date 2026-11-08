# Water Tweaks (LeviLauncher native mod)

Changes how fast water/lava update and how many sources make a new source, by patching 5 ARM64
instructions in `libminecraftpe.so` (found with Zaphkiel in the main liquid tick worker `0x1088d268`).

## Before building (PC / Codespace)
    python3 tools/check_so.py /path/to/libminecraftpe.so     # every line must say OK

## Build
Same as the V3 cine mod: push to GitHub -> Actions -> artifact `water_mod`, or
`ANDROID_NDK_HOME=... ./build.sh`. Import `dist/water_mod.levipack` in LeviLauncher.

## Use
1. Start the game once, edit `water.cfg` in the mod's data folder (created on first load):
       water_delay=5            # ticks, vanilla 5   (1..2000)
       lava_delay_overworld=30  # vanilla 30
       lava_delay_nether=10     # vanilla 10
       infinite_source_count=2  # vanilla 2          (1..8)
2. Mod Menu -> "Water Tweaks" -> ON. Edit the file -> OFF, ON to re-apply.
3. The mod log tells what happened ("patched 5 instruction(s)", or "NOT patching: ...").

## Safety
* Each site is checked against the exact vanilla instruction first. Different Minecraft build =>
  nothing is written ("NOT patching: guard mismatch ...").
* OFF restores the vanilla instructions.
* Local / single-player worlds only: liquid ticks run on the server side.

## Tests
`make -C tests run` (pure patch logic, runs on any PC).

## Not verified yet
* Never compiled against the real Preloader SDK or run on a phone (syntax-checked against stubs only).
* `mprotect` on the game's code pages may be refused on some devices.
* Offsets are for ONE Minecraft build. A signature scan is the next step to survive updates.
