#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
swift scripts/make-icon.swift "$PWD"
node scripts/generate-project.cjs
curl --fail --location --retry 3 https://raw.githubusercontent.com/weichsel/ZIPFoundation/0.9.20/LICENSE -o CrossRoad/Web/ZIPFoundation-LICENSE.txt
xcodebuild -project CrossRoad.xcodeproj -scheme CrossRoad -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -archivePath "$PWD/build/CrossRoad.xcarchive" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO archive
mkdir -p build/package/Payload
ditto build/CrossRoad.xcarchive/Products/Applications/CrossRoad.app build/package/Payload/CrossRoad.app
mkdir -p dist
(cd build/package && /usr/bin/zip -qry ../../dist/CrossRoad-unsigned.ipa Payload)
shasum -a 256 dist/CrossRoad-unsigned.ipa > dist/SHA256SUMS.txt
echo 'Built unsigned IPA. Sign/install with your sideloading tool before using it on an iPhone.'
