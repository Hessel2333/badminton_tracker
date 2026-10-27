import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

@main
struct GearImportGeometry {
  static func main() throws {
    let args = CommandLine.arguments
    guard args.count >= 3 else { fatalError("Usage: gear-import-geometry angle|tube input [output]") }
    let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, nil)!
    let original = CGImageSourceCreateImageAtIndex(source, 0, nil)!
    if args[1] == "angle" {
      guard let angle = RacketAxisGeometry.angle(in: original) else { fatalError("Cannot identify racket shaft") }
      print(angle)
    } else {
      guard args.count == 4, let result = ShuttleTubeCutout.make(from: original) else { fatalError("Tube cutout rejected") }
      let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[3]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
      CGImageDestinationAddImage(destination, result, nil)
      guard CGImageDestinationFinalize(destination) else { fatalError("Cannot write cutout") }
      print("\(result.width)x\(result.height)")
    }
  }
}
