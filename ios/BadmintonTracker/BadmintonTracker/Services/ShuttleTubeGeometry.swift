import CoreGraphics
import Foundation

/// Geometry in image coordinates (origin at the top). Curved caps remain outside the
/// straight-side interval; no pixel content is stretched or removed by this measurement.
struct ShuttleTubeGeometry {
  let bounds: CGRect
  let sideTop: CGFloat
  let sideBottom: CGFloat

  var sideLength: CGFloat { sideBottom - sideTop }
  var baselineFraction: CGFloat { (sideBottom - bounds.minY) / bounds.height }

  func displaySize(sideLength target: CGFloat) -> CGSize {
    let scale = target / sideLength
    return CGSize(width: bounds.width * scale, height: bounds.height * scale)
  }

  static func measure(_ image: CGImage) -> ShuttleTubeGeometry? {
    // Bound analysis cost even when imported photos or catalog assets are large.
    let scale = min(1, 720 / CGFloat(max(image.width, image.height)))
    let width = max(1, Int(CGFloat(image.width) * scale))
    let height = max(1, Int(CGFloat(image.height) * scale))
    guard width >= 8, height >= 32 else { return nil }
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let rendered = pixels.withUnsafeMutableBytes { data -> Bool in
      guard let context = CGContext(data: data.baseAddress, width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard rendered else { return nil }
    var left = [Int](repeating: width, count: height)
    var right = [Int](repeating: -1, count: height)
    var minX = width, maxX = -1, minY = height, maxY = -1
    var transparent = 0
    for y in 0..<height {
      for x in 0..<width {
        let alpha = pixels[(y * width + x) * 4 + 3]
        if alpha < 16 { transparent += 1 }
        if alpha > 16 {
          minX = min(minX, x); maxX = max(maxX, x)
          minY = min(minY, y); maxY = max(maxY, y)
        }
        if alpha >= 192 {
          left[y] = min(left[y], x); right[y] = max(right[y], x)
        }
      }
    }
    // Opaque originals have no trustworthy silhouette. Keep their existing fallback.
    guard transparent > 0, maxX > minX, maxY > minY else { return nil }
    let bodyHeight = maxY - minY + 1
    let aspect = CGFloat(maxX - minX + 1) / CGFloat(bodyHeight)
    guard aspect >= 0.07, aspect <= 0.65 else { return nil }
    let middle = (minY + bodyHeight / 4)...(minY + bodyHeight * 3 / 4)
    let medianLeft = middle.map { left[$0] }.sorted()[middle.count / 2]
    let medianRight = middle.map { right[$0] }.sorted()[middle.count / 2]
    guard medianRight > medianLeft else { return nil }
    let tolerance = max(2, Int(CGFloat(medianRight - medianLeft + 1) * 0.025))
    // Measure each edge independently: packaging seams and imperfect masks may
    // make one edge noisy even though the opposite straight side is reliable.
    let run = max(3, bodyHeight / 100)
    func interval(edge: [Int], reference: Int) -> (top: Int, bottom: Int)? {
      func matches(_ y: Int) -> Bool { abs(edge[y] - reference) <= tolerance }
      guard middle.filter({ matches($0) }).count * 10 >= middle.count * 9 else { return nil }
      let candidates = (minY...(maxY - run + 1)).filter { y in
        (y..<(y + run)).allSatisfy { matches($0) }
      }
      guard let top = candidates.first, let last = candidates.last,
            last + run - top >= bodyHeight * 94 / 100 else { return nil }
      return (top, last + run)
    }
    let sides = [interval(edge: left, reference: medianLeft), interval(edge: right, reference: medianRight)]
      .compactMap { $0 }
    guard !sides.isEmpty else { return nil }
    let top = CGFloat(sides.map { $0.top }.reduce(0, +)) / CGFloat(sides.count)
    let bottom = CGFloat(sides.map { $0.bottom }.reduce(0, +)) / CGFloat(sides.count)
    let sx = CGFloat(image.width) / CGFloat(width)
    let sy = CGFloat(image.height) / CGFloat(height)
    // One sample of padding keeps antialiasing at the original resolution intact.
    let bounds = CGRect(x: CGFloat(max(0, minX - 1)) * sx, y: CGFloat(max(0, minY - 1)) * sy,
      width: CGFloat(min(width - 1, maxX + 1) - max(0, minX - 1) + 1) * sx,
      height: CGFloat(min(height - 1, maxY + 1) - max(0, minY - 1) + 1) * sy)
      .integral.intersection(CGRect(x: 0, y: 0, width: image.width, height: image.height))
    return ShuttleTubeGeometry(bounds: bounds, sideTop: CGFloat(top) * sy, sideBottom: CGFloat(bottom) * sy)
  }
}
