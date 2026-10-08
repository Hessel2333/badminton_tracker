import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

@main
struct RacketAxisGeometryTests {
  static func main() {
    func errorFromVertical(_ angle: CGFloat) -> CGFloat { abs(abs(angle) - 90) }
    func rotated(_ image: CGImage, degrees: CGFloat) -> CGImage {
      let radians = degrees * .pi / 180
      let size = CGRect(x: 0, y: 0, width: image.width, height: image.height)
        .applying(CGAffineTransform(rotationAngle: radians)).integral.size
      let context = CGContext(data: nil, width: Int(size.width), height: Int(size.height),
        bitsPerComponent: 8, bytesPerRow: Int(size.width) * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
      context.translateBy(x: size.width / 2, y: size.height / 2)
      // UIKit's image renderer uses a downward Y axis; reproduce its positive rotation.
      context.rotate(by: -radians)
      context.draw(image, in: CGRect(x: -CGFloat(image.width) / 2, y: -CGFloat(image.height) / 2,
        width: CGFloat(image.width), height: CGFloat(image.height)))
      return context.makeImage()!
    }
    let fixture = CGContext(data: nil, width: 220, height: 600, bitsPerComponent: 8,
      bytesPerRow: 880, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    fixture.setStrokeColor(CGColor(gray: 0.1, alpha: 1))
    fixture.setLineWidth(7)
    fixture.strokeEllipse(in: CGRect(x: 10, y: 370, width: 180, height: 210))
    fixture.move(to: CGPoint(x: 100, y: 100)); fixture.addLine(to: CGPoint(x: 100, y: 375)); fixture.strokePath()
    fixture.setFillColor(CGColor(gray: 0.1, alpha: 1)); fixture.fill(CGRect(x: 90, y: 20, width: 25, height: 90))
    let base = fixture.makeImage()!
    for angle: CGFloat in [-48, -20, 0, 23, 48] {
      let input = rotated(base, degrees: angle)
      let axis = RacketAxisGeometry.angle(in: input)!
      var correction = 90 - axis
      while correction > 90 { correction -= 180 }
      while correction < -90 { correction += 180 }
      let result = rotated(input, degrees: correction)
      assert(errorFromVertical(RacketAxisGeometry.angle(in: result)!) < 0.6)
    }
    print("Synthetic racket axis checks passed")
    guard CommandLine.arguments.count == 3 else { return }
    let url = URL(fileURLWithPath: CommandLine.arguments[1])
    let source = CGImageSourceCreateWithURL(url as CFURL, nil)!
    let original = CGImageSourceCreateImageAtIndex(source, 0, nil)!
    let w = original.width, h = original.height
    var pixels = [UInt8](repeating: 0, count: w * h * 4)
    pixels.withUnsafeMutableBytes { bytes in
      let context = CGContext(data: bytes.baseAddress, width: w, height: h, bitsPerComponent: 8,
        bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
      context.draw(original, in: CGRect(x: 0, y: 0, width: w, height: h))
    }
    var pts: [CGPoint] = []
    for i in stride(from: 0, to: pixels.count, by: 4) {
      if pixels[i + 3] < 12 || (pixels[i + 3] > 220 && pixels[i] >= 246 && pixels[i+1] >= 246 && pixels[i+2] >= 246) {
        for c in 0..<4 { pixels[i+c] = 0 }
      } else { pts.append(CGPoint(x: (i / 4) % w, y: (i / 4) / w)) }
    }
    let provider = CGDataProvider(data: Data(pixels) as CFData)!
    let cutout = CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w*4,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
      provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)!
    let cx = pts.reduce(0) { $0 + $1.x } / CGFloat(pts.count), cy = pts.reduce(0) { $0 + $1.y } / CGFloat(pts.count)
    let xx = pts.reduce(0) { $0 + pow($1.x - cx, 2) }, yy = pts.reduce(0) { $0 + pow($1.y - cy, 2) }
    let xy = pts.reduce(0) { $0 + ($1.x - cx) * ($1.y - cy) }
    let oldAngle = 0.5 * atan2(2 * xy, xx - yy) * 180 / .pi
    guard let angle = RacketAxisGeometry.angle(in: cutout) else { fatalError("No shaft found in sample") }
    var correction = 90 - angle
    while correction > 90 { correction -= 180 }
    while correction < -90 { correction += 180 }
    let output = rotated(cutout, degrees: correction)
    let residual = errorFromVertical(RacketAxisGeometry.angle(in: output)!)
    assert(residual < 0.6)
    print("Whole-image axis: \(oldAngle), shaft axis: \(angle), corrected shaft error: \(residual) degrees")
    let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[2]) as CFURL,
      UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, output, nil)
    assert(CGImageDestinationFinalize(destination))
  }
}
