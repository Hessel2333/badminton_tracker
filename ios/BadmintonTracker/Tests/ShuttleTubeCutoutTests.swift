import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

@main
struct ShuttleTubeCutoutTests {
  static func main() throws {
    func fixture(background: CGFloat, tube: CGFloat, horizontal: Bool = false, irregular: Bool = false) -> CGImage {
      let context = CGContext(data: nil, width: 240, height: 240, bitsPerComponent: 8,
        bytesPerRow: 960, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
      context.setFillColor(CGColor(gray: background, alpha: 1))
      context.fill(CGRect(x: 0, y: 0, width: 240, height: 240))
      context.setFillColor(CGColor(gray: tube, alpha: 1))
      if irregular {
        context.fillEllipse(in: CGRect(x: 40, y: 20, width: 160, height: 200))
      } else if horizontal {
        context.fill(CGRect(x: 20, y: 80, width: 200, height: 36))
      } else {
        context.fill(CGRect(x: 50, y: 20, width: 36, height: 200))
        context.fill(CGRect(x: 140, y: 20, width: 36, height: 200))
        context.setFillColor(CGColor(gray: background, alpha: 1))
        context.fill(CGRect(x: 60, y: 60, width: 16, height: 25))
      }
      return context.makeImage()!
    }
    func alpha(_ image: CGImage, x: Int, y: Int) -> UInt8 {
      let data = image.dataProvider!.data! as Data
      return data[y * image.bytesPerRow + x * 4 + 3]
    }
    let white = ShuttleTubeCutout.make(from: fixture(background: 1, tube: 0.03))!
    assert(white.width == 130 && white.height == 204)
    assert(alpha(white, x: 20, y: 70) == 255, "Lettering inside barrel must remain opaque")
    assert(alpha(white, x: 65, y: 100) == 0, "Gap between tubes must stay transparent")
    let black = ShuttleTubeCutout.make(from: fixture(background: 0, tube: 0.65))!
    assert(alpha(black, x: 65, y: 100) == 0, "Black backdrop must be removed")
    assert(alpha(black, x: 20, y: 70) == 255, "Black print inside tube must survive")
    assert(ShuttleTubeCutout.make(from: fixture(background: 1, tube: 0.03, horizontal: true)) != nil)
    assert(ShuttleTubeCutout.make(from: fixture(background: 1, tube: 0.03, irregular: true)) == nil)
    assert(ShuttleTubeCutout.make(from: fixture(background: 0, tube: 0.03)) == nil, "Low contrast should fall back")

    if CommandLine.arguments.count == 3 {
      let input = URL(fileURLWithPath: CommandLine.arguments[1])
      let source = CGImageSourceCreateWithURL(input as CFURL, nil)!
      let original = CGImageSourceCreateImageAtIndex(source, 0, nil)!
      let result = ShuttleTubeCutout.make(from: original)!
      assert(result.width < original.width / 2)
      assert(result.height > original.height * 4 / 5)
      assert(alpha(result, x: result.width / 2, y: result.height / 2) == 0)
      let output = URL(fileURLWithPath: CommandLine.arguments[2])
      let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil)!
      CGImageDestinationAddImage(destination, result, nil)
      assert(CGImageDestinationFinalize(destination))
      print("Sample passed: \(result.width) × \(result.height), transparent gap preserved")
    }
    print("Shuttle tube regression checks passed")
  }
}
