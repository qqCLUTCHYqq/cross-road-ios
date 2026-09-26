#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/smoke
xcrun simctl list devices available -j > build/smoke/devices.json
DEVICE=$(node -e 'const d=require("./build/smoke/devices.json");for(const [runtime,devices] of Object.entries(d.devices)){if(runtime.includes("iOS")){const p=devices.find(x=>x.name.startsWith("iPhone"));if(p){console.log(p.udid);process.exit(0)}}}process.exit(1)')
xcrun simctl boot "$DEVICE" || true
xcrun simctl bootstatus "$DEVICE" -b
xcodebuild -project CrossRoad.xcodeproj -scheme CrossRoad -configuration Debug \
  -sdk iphonesimulator -destination "id=$DEVICE,arch=arm64" -derivedDataPath "$PWD/build/simulator" \
  ARCHS=arm64 ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO build > build/smoke/simulator-build.txt 2>&1
xcrun simctl install "$DEVICE" build/simulator/Build/Products/Debug-iphonesimulator/CrossRoad.app
xcrun simctl launch "$DEVICE" io.github.qqclutchyqq.crossroad --boot-diagnostic
CONTAINER=$(xcrun simctl get_app_container "$DEVICE" io.github.qqclutchyqq.crossroad data)
for attempt in $(seq 1 60); do
  if [[ -f "$CONTAINER/Documents/boot-test.txt" ]]; then
    cp "$CONTAINER/Documents/boot-test.txt" build/smoke/boot-test.txt
    if grep -q 'PASS: 101 native constructors' build/smoke/boot-test.txt; then
      xcrun simctl io "$DEVICE" screenshot build/smoke/boot.png
      cat build/smoke/boot-test.txt
      exit 0
    fi
    if grep -q 'FAIL:' build/smoke/boot-test.txt; then break; fi
  fi
  sleep 2
done
xcrun simctl io "$DEVICE" screenshot build/smoke/boot.png || true
cat build/smoke/boot-test.txt || true
echo 'Simulator native-runtime boot did not pass.' >&2
exit 1
