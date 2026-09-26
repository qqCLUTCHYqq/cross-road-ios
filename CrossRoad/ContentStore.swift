import Foundation

struct GameAsset: Codable {
    let id: String
    let name: String
    let webkitRelativePath: String
    let size: UInt64
    let nativeAsset: Bool
}

final class ContentStore {
    private let lock = NSLock()
    private var assets: [GameAsset] = []
    private var locations: [String: URL] = [:]
    private let manager = FileManager.default
    private var support: URL { manager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0] }

    func restore() throws {
        if let folder = UserDefaults.standard.string(forKey: "contentFolder") {
            try index(support.appendingPathComponent(folder, isDirectory: true))
        } else if let bundled = Bundle.main.url(forResource: "Content", withExtension: nil),
                  manager.fileExists(atPath: bundled.path) {
            try index(bundled)
        }
    }

    var hasContent: Bool { lock.lock(); defer { lock.unlock() }; return !assets.isEmpty }
    func manifest() throws -> Data { lock.lock(); defer { lock.unlock() }; return try JSONEncoder().encode(assets) }
    func location(for id: String) -> URL? { lock.lock(); defer { lock.unlock() }; return locations[id] }

    // Copy under a new name; only switch the active content after a complete copy/index.
    // Existing content and game saves remain untouched if import fails.
    func importFolder(_ source: URL) throws {
        let scoped = source.startAccessingSecurityScopedResource()
        defer { if scoped { source.stopAccessingSecurityScopedResource() } }
        try manager.createDirectory(at: support, withIntermediateDirectories: true)
        let name = "Content-" + UUID().uuidString
        let destination = support.appendingPathComponent(name, isDirectory: true)
        var coordinationError: NSError?
        var copyError: Error?
        NSFileCoordinator().coordinate(readingItemAt: source, options: .withoutChanges, error: &coordinationError) { url in
            do { try self.manager.copyItem(at: url, to: destination) } catch { copyError = error }
        }
        if let error = coordinationError { throw error }
        if let error = copyError { throw error }
        try index(destination)
        UserDefaults.standard.set(name, forKey: "contentFolder")
        var excluded = destination
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try? excluded.setResourceValues(values)
    }

    private func index(_ folder: URL) throws {
        let root = folder.resolvingSymlinksInPath().standardizedFileURL
        var enumerationError: Error?
        guard let enumerator = manager.enumerator(at: root,
            includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey],
            options: [.skipsHiddenFiles], errorHandler: { _, error in enumerationError = error; return false }) else {
            throw NSError(domain: "Content", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot read the selected folder."])
        }
        var nextAssets: [GameAsset] = [], nextLocations: [String: URL] = [:]
        let urls = enumerator.compactMap { $0 as? URL }.sorted { $0.path < $1.path }
        if let error = enumerationError { throw error }
        for url in urls {
            let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
            guard values.isRegularFile == true, values.isSymbolicLink != true,
                  url.resolvingSymlinksInPath().path.hasPrefix(root.path + "/") else { continue }
            let relative = String(url.path.dropFirst(root.path.count + 1))
            let id = String(nextAssets.count)
            nextAssets.append(GameAsset(id: id, name: url.lastPathComponent,
                webkitRelativePath: "Content/" + relative, size: UInt64(values.fileSize ?? 0), nativeAsset: true))
            nextLocations[id] = url
        }
        guard !nextAssets.isEmpty else {
            throw NSError(domain: "Content", code: 2, userInfo: [NSLocalizedDescriptionKey: "The folder contains no game files. Extract Content.zip before importing."])
        }
        lock.lock(); assets = nextAssets; locations = nextLocations; lock.unlock()
    }
}
