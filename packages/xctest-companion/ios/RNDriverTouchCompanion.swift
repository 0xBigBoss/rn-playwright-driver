import CryptoKit
import Foundation
import Network
import UIKit
import XCTest

private let defaultPort: UInt16 = 9999

final class RNDriverTouchCompanionServer {
  private let port: UInt16
  private var listener: NWListener?
  private let queue = DispatchQueue(label: "rn-driver.touch-companion")

  private var pendingPath: [CGPoint] = []
  private var pendingDownTime: Date?

  init(port: UInt16 = defaultPort) {
    self.port = port
  }

  func start() throws {
    let listener = try NWListener(using: .tcp, on: NWEndpoint.Port(rawValue: port)!)
    listener.newConnectionHandler = { [weak self] connection in
      self?.handle(connection)
    }
    listener.start(queue: queue)
    self.listener = listener
  }

  private func handle(_ connection: NWConnection) {
    let session = WebSocketSession(connection: connection, queue: queue)
    session.onText = { [weak self, weak session] text in
      guard let session else { return }
      self?.handleMessage(text, session: session)
    }
    session.start()
  }

  private func handleMessage(_ text: String, session: WebSocketSession) {
    guard let data = text.data(using: .utf8) else {
      return
    }

    guard
      let payload = try? JSONSerialization.jsonObject(with: data, options: []),
      let dict = payload as? [String: Any],
      let id = dict["id"] as? Int,
      let type = dict["type"] as? String
    else {
      session.sendError(id: nil, message: "Invalid message")
      return
    }

    do {
      switch type {
      case "hello":
        let screen = UIScreen.main.bounds
        let result: [String: Any] = [
          "platform": "ios",
          "scale": UIScreen.main.scale,
          "screen": ["width": screen.width, "height": screen.height]
        ]
        session.sendOk(id: id, result: result)
      case "tap":
        let point = try parsePoint(dict)
        performOnMain {
          self.tap(point)
        }
        session.sendOk(id: id)
      case "down":
        let point = try parsePoint(dict)
        pendingPath = [point]
        pendingDownTime = Date()
        session.sendOk(id: id)
      case "move":
        let point = try parsePoint(dict)
        if pendingPath.isEmpty {
          pendingPath = [point]
        } else {
          pendingPath.append(point)
        }
        session.sendOk(id: id)
      case "up":
        performOnMain {
          self.flushPendingPath()
        }
        session.sendOk(id: id)
      case "swipe":
        let from = try parsePoint(dict, key: "from")
        let to = try parsePoint(dict, key: "to")
        performOnMain {
          self.drag(from: from, to: to, holdSeconds: 0)
        }
        session.sendOk(id: id)
      case "longPress":
        let point = try parsePoint(dict)
        let durationMs = try parseDouble(dict, key: "durationMs")
        performOnMain {
          self.longPress(point, durationSeconds: durationMs / 1000.0)
        }
        session.sendOk(id: id)
      case "typeText":
        let text = try parseString(dict, key: "text")
        performOnMain {
          self.typeText(text)
        }
        session.sendOk(id: id)
      default:
        session.sendError(id: id, message: "Unsupported command: \(type)")
      }
    } catch {
      session.sendError(id: id, message: error.localizedDescription)
    }
  }

  private func performOnMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.sync(execute: work)
    }
  }

  private func coordinate(for point: CGPoint) -> XCUICoordinate {
    let origin = XCUIScreen.main.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
    return origin.withOffset(CGVector(dx: point.x, dy: point.y))
  }

  private func tap(_ point: CGPoint) {
    coordinate(for: point).tap()
  }

  private func longPress(_ point: CGPoint, durationSeconds: Double) {
    coordinate(for: point).press(forDuration: durationSeconds)
  }

  private func drag(from: CGPoint, to: CGPoint, holdSeconds: Double) {
    coordinate(for: from).press(forDuration: holdSeconds, thenDragTo: coordinate(for: to))
  }

  private func flushPendingPath() {
    guard let start = pendingPath.first else { return }
    let end = pendingPath.last ?? start
    let holdSeconds: Double
    if let downTime = pendingDownTime {
      holdSeconds = max(0.0, Date().timeIntervalSince(downTime))
    } else {
      holdSeconds = 0.0
    }
    drag(from: start, to: end, holdSeconds: holdSeconds)
    pendingPath = []
    pendingDownTime = nil
  }

  private func typeText(_ text: String) {
    let app = XCUIApplication()
    app.activate()
    app.typeText(text)
  }

  private func parsePoint(_ dict: [String: Any], key: String = "") throws -> CGPoint {
    if key.isEmpty {
      let x = try parseDouble(dict, key: "x")
      let y = try parseDouble(dict, key: "y")
      return CGPoint(x: x, y: y)
    }

    guard let nested = dict[key] as? [String: Any] else {
      throw NSError(domain: "RNDriverTouchCompanion", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Missing point: \(key)"
      ])
    }
    let x = try parseDouble(nested, key: "x")
    let y = try parseDouble(nested, key: "y")
    return CGPoint(x: x, y: y)
  }

  private func parseDouble(_ dict: [String: Any], key: String) throws -> Double {
    if let value = dict[key] as? Double {
      return value
    }
    if let value = dict[key] as? Int {
      return Double(value)
    }
    throw NSError(domain: "RNDriverTouchCompanion", code: 2, userInfo: [
      NSLocalizedDescriptionKey: "Missing numeric field: \(key)"
    ])
  }

  private func parseString(_ dict: [String: Any], key: String) throws -> String {
    guard let value = dict[key] as? String else {
      throw NSError(domain: "RNDriverTouchCompanion", code: 3, userInfo: [
        NSLocalizedDescriptionKey: "Missing string field: \(key)"
      ])
    }
    return value
  }
}

private final class WebSocketSession {
  private let connection: NWConnection
  private let queue: DispatchQueue
  private var buffer = Data()
  private var isWebSocket = false

  var onText: ((String) -> Void)?

  init(connection: NWConnection, queue: DispatchQueue) {
    self.connection = connection
    self.queue = queue
  }

  func start() {
    connection.start(queue: queue)
    receive()
  }

  func sendOk(id: Int, result: [String: Any]? = nil) {
    var payload: [String: Any] = ["id": id, "ok": true]
    if let result {
      payload["result"] = result
    }
    send(payload)
  }

  func sendError(id: Int?, message: String) {
    var payload: [String: Any] = ["ok": false, "error": ["message": message]]
    if let id {
      payload["id"] = id
    }
    send(payload)
  }

  private func send(_ payload: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
      return
    }
    sendText(String(data: data, encoding: .utf8) ?? "{}")
  }

  private func sendText(_ text: String) {
    let payload = Data(text.utf8)
    var frame = Data()
    frame.append(0x81)

    if payload.count < 126 {
      frame.append(UInt8(payload.count))
    } else if payload.count <= 0xFFFF {
      frame.append(126)
      frame.append(UInt8((payload.count >> 8) & 0xFF))
      frame.append(UInt8(payload.count & 0xFF))
    } else {
      frame.append(127)
      let length = UInt64(payload.count)
      for shift in stride(from: 56, through: 0, by: -8) {
        frame.append(UInt8((length >> UInt64(shift)) & 0xFF))
      }
    }

    frame.append(payload)
    connection.send(content: frame, completion: .contentProcessed { _ in })
  }

  private func receive() {
    connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) {
      [weak self] data, _, isComplete, error in
      guard let self else { return }
      if let data {
        self.buffer.append(data)
      }

      if !self.isWebSocket {
        self.handleHandshakeIfPossible()
      }

      if self.isWebSocket {
        self.handleFrames()
      }

      if error == nil, !isComplete {
        self.receive()
      }
    }
  }

  private func handleHandshakeIfPossible() {
    guard let range = buffer.range(of: Data("\r\n\r\n".utf8)) else {
      return
    }

    let requestData = buffer.subdata(in: 0..<range.upperBound)
    buffer.removeSubrange(0..<range.upperBound)

    guard let request = String(data: requestData, encoding: .utf8) else {
      return
    }

    guard let keyLine = request.split(separator: "\n").first(where: { line in
      line.lowercased().hasPrefix("sec-websocket-key")
    }) else {
      return
    }

    let parts = keyLine.split(separator: ":")
    guard parts.count >= 2 else { return }
    let key = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
    let accept = websocketAccept(for: key)

    let response = "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: \(accept)\r\n\r\n"

    connection.send(content: response.data(using: .utf8), completion: .contentProcessed { _ in })
    isWebSocket = true
  }

  private func handleFrames() {
    while true {
      guard buffer.count >= 2 else { return }
      let firstByte = buffer[0]
      let secondByte = buffer[1]
      let opcode = firstByte & 0x0F
      let masked = (secondByte & 0x80) != 0
      var payloadLength = Int(secondByte & 0x7F)
      var offset = 2

      if payloadLength == 126 {
        guard buffer.count >= 4 else { return }
        payloadLength = Int(buffer[2]) << 8 | Int(buffer[3])
        offset = 4
      } else if payloadLength == 127 {
        guard buffer.count >= 10 else { return }
        var length: UInt64 = 0
        for i in 2..<10 {
          length = (length << 8) | UInt64(buffer[i])
        }
        payloadLength = Int(length)
        offset = 10
      }

      let maskKeyLength = masked ? 4 : 0
      let frameLength = offset + maskKeyLength + payloadLength
      guard buffer.count >= frameLength else { return }

      var payload = buffer.subdata(in: (offset + maskKeyLength)..<frameLength)
      if masked {
        let maskStart = buffer.subdata(in: offset..<(offset + 4))
        let maskBytes = [UInt8](maskStart)
        var bytes = [UInt8](payload)
        for i in 0..<bytes.count {
          bytes[i] ^= maskBytes[i % 4]
        }
        payload = Data(bytes)
      }

      buffer.removeSubrange(0..<frameLength)

      switch opcode {
      case 0x1:
        if let text = String(data: payload, encoding: .utf8) {
          onText?(text)
        }
      case 0x8:
        connection.cancel()
        return
      case 0x9:
        sendPong(payload)
      default:
        continue
      }
    }
  }

  private func sendPong(_ payload: Data) {
    var frame = Data()
    frame.append(0x8A)
    if payload.count < 126 {
      frame.append(UInt8(payload.count))
    } else {
      frame.append(126)
      frame.append(UInt8((payload.count >> 8) & 0xFF))
      frame.append(UInt8(payload.count & 0xFF))
    }
    frame.append(payload)
    connection.send(content: frame, completion: .contentProcessed { _ in })
  }

  private func websocketAccept(for key: String) -> String {
    let magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    let combined = key + magic
    let hash = Insecure.SHA1.hash(data: Data(combined.utf8))
    return Data(hash).base64EncodedString()
  }
}

final class RNDriverTouchCompanionTests: XCTestCase {
  func testRunServer() throws {
    let server = RNDriverTouchCompanionServer()
    try server.start()
    RunLoop.current.run()
  }
}
