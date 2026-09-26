import Foundation
import Network

// Loopback only. A per-launch token protects every resource path. A fixed origin
// keeps WKWebView's IndexedDB saves stable across launches.
final class LocalServer {
    private let queue = DispatchQueue(label: "crossroad.loopback", qos: .userInitiated)
    private var listener: NWListener?
    private let content: ContentStore
    private let root: URL
    private let token = UUID().uuidString
    private let port: UInt16 = 18761
    private var connections: [ObjectIdentifier: NWConnection] = [:]
    init(content: ContentStore, root: URL) { self.content = content; self.root = root }
    var baseURL: URL { URL(string: "http://127.0.0.1:\(port)/\(token)/")! }

    func start(completion: @escaping (Result<URL, Error>) -> Void) throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!)
        let listener = try NWListener(using: parameters)
        self.listener = listener
        var delivered = false
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                if !delivered { delivered = true; DispatchQueue.main.async { completion(.success(self.baseURL)) } }
            case .failed(let error):
                if !delivered { delivered = true; DispatchQueue.main.async { completion(.failure(error)) } }
            default: break
            }
        }
        listener.newConnectionHandler = { connection in
            let key = ObjectIdentifier(connection)
            self.connections[key] = connection
            connection.stateUpdateHandler = { state in
                switch state {
                case .cancelled, .failed: self.connections.removeValue(forKey: key)
                default: break
                }
            }
            connection.start(queue: self.queue)
            self.receive(connection, buffer: Data())
        }
        listener.start(queue: queue)
    }

    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { data, _, complete, error in
            var buffer = buffer; if let data { buffer.append(data) }
            guard buffer.count <= 16384 else { self.send(connection, status: 431); return }
            if let end = buffer.range(of: Data("\r\n\r\n".utf8)) {
                self.route(connection, header: String(decoding: buffer[..<end.lowerBound], as: UTF8.self))
            } else if complete || error != nil { connection.cancel() }
            else { self.receive(connection, buffer: buffer) }
        }
    }

    private func route(_ connection: NWConnection, header: String) {
        let lines = header.components(separatedBy: "\r\n")
        let request = (lines.first ?? "").split(separator: " ")
        guard request.count == 3, request[0] == "GET",
              let components = URLComponents(string: "http://127.0.0.1" + String(request[1])),
              components.path.hasPrefix("/\(token)/") else { send(connection, status: 403); return }
        let route = String(components.path.dropFirst(token.count + 2))
        do {
            if route == "native/manifest" { send(connection, data: try content.manifest(), mime: "application/json"); return }
            if route == "native/file" {
                let items = components.queryItems ?? []
                guard let id = items.first(where: { $0.name == "id" })?.value,
                      let file = content.location(for: id),
                      let offsetText = items.first(where: { $0.name == "offset" })?.value,
                      let offset = UInt64(offsetText),
                      let lengthText = items.first(where: { $0.name == "length" })?.value,
                      let length = Int(lengthText), (0...8_388_608).contains(length) else { send(connection, status: 400); return }
                let handle = try FileHandle(forReadingFrom: file); defer { try? handle.close() }
                let size = try handle.seekToEnd()
                guard offset <= size, UInt64(length) <= size - offset else { send(connection, status: 416); return }
                try handle.seek(toOffset: offset)
                let data = try handle.read(upToCount: length) ?? Data()
                guard data.count == length else { send(connection, status: 500); return }
                send(connection, data: data); return
            }
            let relative = route.isEmpty ? "game.html" : route
            let file = root.appendingPathComponent(relative).standardizedFileURL.resolvingSymlinksInPath()
            guard file.path.hasPrefix(root.resolvingSymlinksInPath().path + "/"),
                  FileManager.default.fileExists(atPath: file.path) else { send(connection, status: 404); return }
            let mime = ["html":"text/html; charset=utf-8", "js":"text/javascript; charset=utf-8", "json":"application/json", "gz":"application/gzip", "png":"image/png"][file.pathExtension] ?? "application/octet-stream"
            let handle = try FileHandle(forReadingFrom: file)
            let size = try handle.seekToEnd(); try handle.seek(toOffset: 0)
            let headers = responseHeader(status: 200, size: size, mime: mime)
            connection.send(content: headers, completion: .contentProcessed { error in
                if error != nil { try? handle.close(); connection.cancel() }
                else { self.stream(handle, remaining: size, connection: connection) }
            })
        } catch { send(connection, status: 500) }
    }

    private func stream(_ handle: FileHandle, remaining: UInt64, connection: NWConnection) {
        guard remaining > 0 else { try? handle.close(); connection.cancel(); return }
        do {
            let data = try handle.read(upToCount: Int(min(remaining, 262144))) ?? Data()
            guard !data.isEmpty else { try? handle.close(); connection.cancel(); return }
            connection.send(content: data, completion: .contentProcessed { error in
                if error != nil { try? handle.close(); connection.cancel() }
                else { self.stream(handle, remaining: remaining - UInt64(data.count), connection: connection) }
            })
        } catch { try? handle.close(); connection.cancel() }
    }

    private func responseHeader(status: Int, size: UInt64, mime: String) -> Data {
        let policy = "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob: data:; frame-src 'self' about:"
        return Data("HTTP/1.1 \(status) \(status == 200 ? "OK" : "Error")\r\nContent-Length: \(size)\r\nContent-Type: \(mime)\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: \(policy)\r\n\r\n".utf8)
    }
    private func send(_ connection: NWConnection, status: Int = 200, data: Data = Data(), mime: String = "application/octet-stream") {
        var response = responseHeader(status: status, size: UInt64(data.count), mime: mime); response.append(data)
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
}


