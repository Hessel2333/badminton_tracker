import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

@main
struct ShuttleTubeGeometryTests {
  static func main() throws {
    func fixture(curved: Bool, padding: Int, opaque: Bool = false) -> CGImage {
      let w = 60 + padding * 2, h = 300 + padding * 2
      let context = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
        bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
      if opaque {
        context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: w, height: h))
      }
      context.setFillColor(CGColor(gray: 0.2, alpha: 1))
      let box = CGRect(x: padding, y: padding, width: 60, height: 300)
      if curved {
        context.addPath(CGPath(roundedRect: box, cornerWidth: 24, cornerHeight: 15, transform: nil))
        context.fillPath()
      } else { context.fill(box) }
      return context.makeImage()!
    }
    let rectangle = ShuttleTubeGeometry.measure(fixture(curved: false, padding: 12))!
    let curved = ShuttleTubeGeometry.measure(fixture(curved: true, padding: 12))!
    let padded = ShuttleTubeGeometry.measure(fixture(curved: true, padding: 40))!
    assert(curved.sideLength < rectangle.sideLength)
    assert(abs(padded.sideLength - curved.sideLength) < 1)
    for geometry in [rectangle, curved, padded] {
      let size = geometry.displaySize(sideLength: 200)
      assert(abs(size.height * geometry.sideLength / geometry.bounds.height - 200) < 0.001)
      assert(abs(size.width / size.height - geometry.bounds.width / geometry.bounds.height) < 0.001)
      let y = 250 - size.height * geometry.baselineFraction
      assert(abs(y + size.height * geometry.baselineFraction - 250) < 0.001)
      assert(y >= 0 && y + size.height < 280)
    }
    assert(ShuttleTubeGeometry.measure(fixture(curved: false, padding: 12, opaque: true)) == nil)
    print("Geometry tests passed: cap preservation, padding invariance, aspect ratio, baseline and fallback")

    guard CommandLine.arguments.count == 3 else { return }
    let root = URL(fileURLWithPath: CommandLine.arguments[1])
    let files = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
      .filter { $0.lastPathComponent.contains("shuttlecock") && $0.pathExtension == "png" }.sorted { $0.path < $1.path }
    var measured: [(URL, CGImage, ShuttleTubeGeometry)] = []
    for file in files {
      guard let source = CGImageSourceCreateWithURL(file as CFURL, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { continue }
      if let geometry = ShuttleTubeGeometry.measure(image) {
        measured.append((file, image, geometry))
      } else { print("Fallback: \(file.lastPathComponent)") }
    }
    print("Measured \(measured.count)/\(files.count) catalog tubes")
    let selected = measured.enumerated().filter { $0.offset % 3 == 0 }.map { $0.element }
    let canvasWidth = max(800, selected.count * 110), canvasHeight = 510
    let context = CGContext(data: nil, width: canvasWidth, height: canvasHeight, bitsPerComponent: 8,
      bytesPerRow: canvasWidth * 4, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.setFillColor(CGColor(gray: 0.92, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight))
    let baseline: CGFloat = 455
    for (index, entry) in selected.enumerated() {
      let (_, image, geometry) = entry
      let size = geometry.displaySize(sideLength: 390)
      let y = baseline - size.height * geometry.baselineFraction
      context.draw(image.cropping(to: geometry.bounds)!, in: CGRect(x: CGFloat(index * 110 + 20),
        y: CGFloat(canvasHeight) - y - size.height, width: size.width, height: size.height))
    }
    context.setStrokeColor(CGColor(red: 0.15, green: 0.45, blue: 0.8, alpha: 0.7))
    context.setLineWidth(1)
    for y in [baseline, baseline - 390] {
      context.move(to: CGPoint(x: 0, y: CGFloat(canvasHeight) - y))
      context.addLine(to: CGPoint(x: CGFloat(canvasWidth), y: CGFloat(canvasHeight) - y))
      context.strokePath()
    }
    let output = URL(fileURLWithPath: CommandLine.arguments[2])
    let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, context.makeImage()!, nil)
    assert(CGImageDestinationFinalize(destination))
  }
}
