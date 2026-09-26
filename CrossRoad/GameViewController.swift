import UIKit
import WebKit
import UniformTypeIdentifiers

final class GameViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler, UIDocumentPickerDelegate {
    private let content = ContentStore()
    private var server: LocalServer?
    private var baseURL: URL?
    private var webView: WKWebView!
    private let status = UILabel()
    private let menu = UIButton(type: .system)
    private var logLines: [String] = []
    private var importing = false
    private var installer: ContentInstaller?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: "nativeLog")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        status.textColor = .white; status.numberOfLines = 0; status.textAlignment = .center
        status.font = .preferredFont(forTextStyle: .body)
        status.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(status)
        menu.setImage(UIImage(systemName: "ellipsis.circle.fill"), for: .normal)
        menu.tintColor = .white
        menu.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        menu.layer.cornerRadius = 22
        menu.accessibilityLabel = "Game options"
        menu.addTarget(self, action: #selector(showOptions), for: .touchUpInside)
        menu.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(menu)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            status.centerXAnchor.constraint(equalTo: view.centerXAnchor), status.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            status.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 30),
            status.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -30),
            menu.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            menu.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -8),
            menu.widthAnchor.constraint(equalToConstant: 44), menu.heightAnchor.constraint(equalToConstant: 44)
        ])
        NotificationCenter.default.addObserver(self, selector: #selector(flushSaves), name: UIApplication.willResignActiveNotification, object: nil)
        status.text = "Preparing local game files…"
        DispatchQueue.global(qos: .userInitiated).async {
            do { try self.content.restore() }
            catch { DispatchQueue.main.async { self.record("Content: \(error.localizedDescription)") } }
            DispatchQueue.main.async { self.startServer() }
        }
    }

    private func startServer() {
        guard let root = Bundle.main.url(forResource: "Web", withExtension: nil) else { fail("Bundled runtime is missing."); return }
        server = LocalServer(content: content, root: root)
        do {
            try server?.start { result in
                switch result {
                case .success(let url):
                    self.baseURL = url
                    if ProcessInfo.processInfo.arguments.contains("--boot-diagnostic") {
                        self.status.text = nil
                        self.webView.load(URLRequest(url: URL(string: "index.html?autoRun=1", relativeTo: url)!.absoluteURL))
                    } else { self.launchGame() }
                case .failure(let error): self.fail("Local runtime server: \(error.localizedDescription)")
                }
            }
        } catch { fail(error.localizedDescription) }
    }

    private func launchGame() {
        guard let baseURL else { return }
        guard content.hasContent else {
            status.text = "Cross Road\n\nUse Game options (•••) to download game content (2.24 GB over Wi-Fi) or import an existing folder.\nAfter setup, the game opens directly from this icon."
            return
        }
        status.text = "Starting Cross Road…"
        webView.load(URLRequest(url: baseURL.appendingPathComponent("game.html")))
    }

    @objc private func showOptions() {
        guard !importing else { return }
        let sheet = UIAlertController(title: "Cross Road", message: nil, preferredStyle: .actionSheet)
        sheet.addAction(UIAlertAction(title: "Download game content (2.24 GB)", style: .default) { _ in self.downloadContent() })
        sheet.addAction(UIAlertAction(title: "Import extracted Content folder", style: .default) { _ in
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.delegate = self; picker.allowsMultipleSelection = false
            self.present(picker, animated: true)
        })
        sheet.addAction(UIAlertAction(title: "Restart game", style: .default) { _ in self.launchGame() })
        sheet.addAction(UIAlertAction(title: "Run boot diagnostic", style: .default) { _ in
            if let base = self.baseURL { self.status.text = nil; self.webView.scrollView.isScrollEnabled = true; self.webView.load(URLRequest(url: base.appendingPathComponent("index.html"))) }
        })
        sheet.addAction(UIAlertAction(title: "Share startup log", style: .default) { _ in
            let activity = UIActivityViewController(activityItems: [self.logLines.joined(separator: "\n")], applicationActivities: nil)
            activity.popoverPresentationController?.sourceView = self.menu
            self.present(activity, animated: true)
        })
        sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        sheet.popoverPresentationController?.sourceView = menu
        present(sheet, animated: true)
    }

    private func downloadContent() {
        let alert = UIAlertController(title: "Download game content", message: "Download 2.24 GB from the preservation archive over Wi-Fi, then unpack it locally. Allow several GB of free space and keep the app open during setup.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Download", style: .default) { _ in
            self.importing = true
            self.webView.loadHTMLString("", baseURL: nil)
            UIApplication.shared.isIdleTimerDisabled = true
            self.installer = ContentInstaller(store: self.content, update: { [weak self] text in self?.status.text = text }, completion: { [weak self] error in
                guard let self else { return }
                self.importing = false; self.installer = nil
                UIApplication.shared.isIdleTimerDisabled = false
                if let error { self.fail("Content setup failed: \(error.localizedDescription)") }
                else { self.launchGame() }
            })
            self.installer?.start()
        })
        present(alert, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let source = urls.first else { return }
        importing = true; webView.loadHTMLString("", baseURL: nil)
        status.text = "Copying content to this iPhone…\nKeep the app open. Large folders can take several minutes."
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try self.content.importFolder(source)
                DispatchQueue.main.async { self.importing = false; self.launchGame() }
            } catch {
                DispatchQueue.main.async { self.importing = false; self.fail("Content import failed: \(error.localizedDescription)") }
            }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let origin = message.frameInfo.request.url,
              origin.host == "127.0.0.1", origin.port == baseURL?.port,
              let text = message.body as? String else { return }
        record(text)
        if text.contains("first render-loop iteration completed") { status.text = nil }
        if text.hasPrefix("FAIL:") || text.hasPrefix("Page error:") || text.hasPrefix("Unhandled error:") { fail(text) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.absoluteString == "about:blank" || url.scheme == "blob" { decisionHandler(.allow); return }
        if let baseURL, url.scheme == "http", url.host == baseURL.host, url.port == baseURL.port, url.path.hasPrefix(baseURL.path) {
            decisionHandler(.allow)
        } else { decisionHandler(.cancel) }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(error.localizedDescription) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail(error.localizedDescription) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { fail("iOS stopped the game process, possibly due to memory pressure. Use Game options to restart and share the log.") }
    @objc private func flushSaves() { webView?.evaluateJavaScript("globalThis.__nativeFlush?.()", completionHandler: nil) }
    private func record(_ text: String) {
        logLines.append(String(text.prefix(4000)))
        if logLines.count > 300 { logLines.removeFirst(logLines.count - 300) }
        if ProcessInfo.processInfo.arguments.contains("--boot-diagnostic") {
            let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            try? logLines.joined(separator: "\n").write(to: folder.appendingPathComponent("boot-test.txt"), atomically: true, encoding: .utf8)
        }
    }
    private func fail(_ text: String) { record(text); status.text = text + "\n\nUse Game options (•••) to share the startup log." }
}
