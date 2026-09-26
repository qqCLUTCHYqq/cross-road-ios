import Foundation
import CryptoKit

final class ContentInstaller: NSObject, URLSessionDownloadDelegate {
    private let store: ContentStore
    private let update: (String) -> Void
    private let completion: (Error?) -> Void
    private var session: URLSession?
    private var extracting = false
    private var lastPercent = -1
    private let expectedBytes: Int64 = 2_244_643_150
    private let expectedSHA1 = "818f4cb61d7a6cd2ce75cc3e74a7311d336a448e"
    init(store: ContentStore, update: @escaping (String) -> Void, completion: @escaping (Error?) -> Void) {
        self.store = store; self.update = update; self.completion = completion
    }
    func start() {
        let configuration = URLSessionConfiguration.default
        configuration.allowsCellularAccess = false
        configuration.timeoutIntervalForRequest = 120
        configuration.timeoutIntervalForResource = 14_400
        let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        self.session = session
        let url = URL(string: "https://archive.org/download/khux-5.0.1-ww-web/Content.zip")!
        session.downloadTask(with: url).resume()
        DispatchQueue.main.async { self.update("Downloading game content over Wi-Fi…\nKeep the app open. Download: 2.24 GB.") }
    }
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        let percent = Int(min(100, totalBytesWritten * 100 / expectedBytes))
        guard percent != lastPercent else { return }; lastPercent = percent
        DispatchQueue.main.async { self.update("Downloading game content: \(percent)%\nKeep the app open on Wi-Fi.") }
    }
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        extracting = true
        let file = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("Content-\(UUID().uuidString).zip")
        do {
            guard let response = downloadTask.response as? HTTPURLResponse, response.statusCode == 200 else { throw URLError(.badServerResponse) }
            try FileManager.default.moveItem(at: location, to: file)
        } catch { finish(error); return }
        DispatchQueue.global(qos: .userInitiated).async {
            defer { try? FileManager.default.removeItem(at: file) }
            do {
                DispatchQueue.main.async { self.update("Verifying downloaded content…") }
                let handle = try FileHandle(forReadingFrom: file)
                defer { try? handle.close() }
                var digest = Insecure.SHA1(), total: Int64 = 0
                while let data = try handle.read(upToCount: 1_048_576), !data.isEmpty { digest.update(data: data); total += Int64(data.count) }
                let checksum = digest.finalize().map { String(format: "%02x", $0) }.joined()
                guard total == self.expectedBytes, checksum == self.expectedSHA1 else {
                    throw NSError(domain: "Content", code: 5, userInfo: [NSLocalizedDescriptionKey: "Downloaded content does not match the preservation archive. Please retry or import your own extracted folder."])
                }
                DispatchQueue.main.async { self.update("Unpacking game content…\nThis can take several minutes. Keep the app open.") }
                try self.store.installArchive(file, progress: Progress())
                self.finish(nil)
            } catch { self.finish(error) }
        }
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error, !extracting { finish(error) }
    }
    private func finish(_ error: Error?) {
        session?.finishTasksAndInvalidate(); session = nil
        DispatchQueue.main.async { self.completion(error) }
    }
}
