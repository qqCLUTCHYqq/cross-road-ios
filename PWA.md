# Cross Road PWA

The Safari build is in `CrossRoad/Web`. It includes the converted wasm32 runtime, an install manifest, service-worker caching, iPhone safe-area metadata, and an IndexedDB bridge. The first time a user chooses the extracted `Content` folder, the bridge stores the selected files on that device and restores them automatically on later launches.

## Deploy with GitHub Pages

1. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
2. Push to `main`, or run **Deploy Cross Road PWA** from the Actions tab.
3. Open `https://qqclutchyqq.github.io/cross-road-ios/` in Safari on iPhone.
4. Tap **Share → Add to Home Screen**, then launch **Cross Road** from the new icon.
5. The first launch needs an extracted compatible `Content` folder. After the initial selection, the PWA saves the files in IndexedDB and restores them without another folder selection.

GitHub Pages supplies HTTPS, which is required for service workers and installability. The site shell can run offline after its first visit; game content is kept in browser storage and is not committed to GitHub or bundled into the site. iOS storage quotas vary, so importing a 2.24 GB folder may require a device with sufficient free space.

For a quick local test, serve `CrossRoad/Web` from an HTTPS or localhost server and open `index.html`. Opening the files directly from the Files app will not work because service workers and WebAssembly workers need a secure origin.
