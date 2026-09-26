import AppKit
import Foundation
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let source = root.appendingPathComponent("CrossRoad/CrossRoadIcon.png")
guard let image = NSImage(contentsOf: source) else { fatalError("Source icon missing") }
let size = 1024
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSColor(calibratedRed: 0.06, green: 0.09, blue: 0.14, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: size, height: size)).fill()
image.draw(in: NSRect(x: 64, y: 64, width: 896, height: 896))
NSGraphicsContext.restoreGraphicsState()
let folder = root.appendingPathComponent("CrossRoad/Assets.xcassets/AppIcon.appiconset")
try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
try bitmap.representation(using: .png, properties: [:])!.write(to: folder.appendingPathComponent("AppIcon.png"))
let contents = """
{"images":[{"filename":"AppIcon.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}
"""
try Data(contents.utf8).write(to: folder.appendingPathComponent("Contents.json"))
