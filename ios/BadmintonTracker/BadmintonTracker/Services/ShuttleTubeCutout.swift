import CoreGraphics
import Foundation

/// A conservative alternative to semantic segmentation for pack shots of shuttle tubes.
/// Only accepts a uniform surround and separate, substantially solid elongated objects.
enum ShuttleTubeCutout {
  static func make(from image: CGImage) -> CGImage? {
    let width = image.width, height = image.height
    guard width >= 32, height >= 32 else { return nil }
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let rendered = pixels.withUnsafeMutableBytes { bytes -> Bool in
      guard let context = CGContext(data: bytes.baseAddress, width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard rendered else { return nil }

    // Sample all four edges, not the item's dark/light pixels, to estimate the backdrop.
    var border: [Int] = []
    for x in stride(from: 0, to: width, by: max(1, width / 100)) {
      border.append(x); border.append((height - 1) * width + x)
    }
    for y in stride(from: 0, to: height, by: max(1, height / 100)) {
      border.append(y * width); border.append(y * width + width - 1)
    }
    let background = (0..<3).map { channel in
      let values = border.map { Int(pixels[$0 * 4 + channel]) }.sorted()
      return values[values.count / 2]
    }
    func distance(_ index: Int) -> Int {
      (0..<3).map { abs(Int(pixels[index * 4 + $0]) - background[$0]) }.max() ?? 0
    }
    guard border.allSatisfy({ pixels[$0 * 4 + 3] > 250 }),
          Double(border.filter { distance($0) < 20 }.count) / Double(border.count) > 0.98 else {
      return nil
    }
    var foreground = [UInt8](repeating: 0, count: width * height)
    for index in foreground.indices where distance(index) > 42 { foreground[index] = 1 }
    var mask = [UInt8](repeating: 0, count: width * height)
    var acceptedArea = 0, significantArea = 0, tubeCount = 0
    var bounds = CGRect.null
    for seed in foreground.indices where foreground[seed] == 1 {
      var component = [seed], cursor = 0
      foreground[seed] = 0
      var minX = width, minY = height, maxX = 0, maxY = 0
      while cursor < component.count {
        let index = component[cursor]; cursor += 1
        let x = index % width, y = index / width
        minX = min(minX, x); maxX = max(maxX, x)
        minY = min(minY, y); maxY = max(maxY, y)
        func visit(_ neighbor: Int) {
          if foreground[neighbor] == 1 {
            foreground[neighbor] = 0
            component.append(neighbor)
          }
        }
        if x > 0 { visit(index - 1) }
        if x + 1 < width { visit(index + 1) }
        if y > 0 { visit(index - width) }
        if y + 1 < height { visit(index + width) }
      }
      guard component.count > width * height / 1000 else { continue }
      significantArea += component.count
      let w = maxX - minX + 1, h = maxY - minY + 1
      let ratio = Double(max(w, h)) / Double(min(w, h))
      guard minX > 1, minY > 1, maxX < width - 2, maxY < height - 2,
            ratio >= 3, ratio <= 12,
            max(w, h) >= max(width, height) / 4,
            Double(component.count) / Double(w * h) >= 0.82 else { continue }

      // Fill only inside each tube's scanline contour. This retains white lettering and
      // dark barrel surfaces without joining adjacent tubes or imposing a rectangle.
      let vertical = h >= w
      let lineCount = vertical ? height : width
      var starts = [Int](repeating: Int.max, count: lineCount)
      var ends = [Int](repeating: -1, count: lineCount)
      for index in component {
        let x = index % width, y = index / width
        let line = vertical ? y : x, position = vertical ? x : y
        starts[line] = min(starts[line], position)
        ends[line] = max(ends[line], position)
      }
      for line in 0..<lineCount where ends[line] >= starts[line] {
        for position in starts[line]...ends[line] {
          let index = vertical ? line * width + position : position * width + line
          mask[index] = 255
        }
      }
      acceptedArea += component.count
      tubeCount += 1
      bounds = bounds.union(CGRect(x: minX, y: minY, width: w, height: h))
    }
    // Avoid silently dropping a second object or accepting a cluttered scene.
    guard tubeCount > 0, tubeCount <= 4, acceptedArea > width * height / 100,
          Double(acceptedArea) / Double(max(1, significantArea)) > 0.95 else { return nil }
    for index in mask.indices where mask[index] == 0 {
      for channel in 0..<4 { pixels[index * 4 + channel] = 0 }
    }
    guard let provider = CGDataProvider(data: Data(pixels) as CFData),
          let result = CGImage(width: width, height: height, bitsPerComponent: 8,
            bitsPerPixel: 32, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent) else { return nil }
    let crop = bounds.insetBy(dx: -2, dy: -2).intersection(CGRect(x: 0, y: 0, width: width, height: height))
    return result.cropping(to: crop)
  }
}
