#!/bin/sh
set -eu

cd "$(dirname "$0")"
cargo build --locked --release

app="Orbit Swap.app"
mkdir -p "$app/Contents/MacOS"
install -m 755 target/release/orbit-swap-desktop "$app/Contents/MacOS/orbit-swap-desktop"
install -m 644 Info.plist "$app/Contents/Info.plist"
codesign --force --sign - "$app"
printf '\nFinder에서 %s/%s을 열면 됩니다.\n' "$(pwd)" "$app"
