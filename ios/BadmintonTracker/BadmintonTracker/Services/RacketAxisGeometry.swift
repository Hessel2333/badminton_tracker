import CoreGraphics
import Foundation

/// Finds the shaft axis rather than allowing the asymmetric head and grip to tilt it.
enum RacketAxisGeometry {
  static func angle(in image: CGImage) -> CGFloat? {
    let scale = min(1, 720 / CGFloat(max(image.width, image.height)))
    let width = max(1, Int(CGFloat(image.width) * scale))
    let height = max(1, Int(CGFloat(image.height) * scale))
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let rendered = pixels.withUnsafeMutableBytes { bytes -> Bool in
      guard let context = CGContext(data: bytes.baseAddress, width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard rendered else { return nil }
    var points: [CGPoint] = []
    for y in 0..<height {
      for x in 0..<width {
        let i = (y * width + x) * 4
        guard pixels[i + 3] > 128,
              !(pixels[i] >= 246 && pixels[i + 1] >= 246 && pixels[i + 2] >= 246) else { continue }
        points.append(CGPoint(x: x, y: y))
      }
    }
    guard points.count >= 64 else { return nil }
    let center = CGPoint(x: points.reduce(0) { $0 + $1.x } / CGFloat(points.count),
      y: points.reduce(0) { $0 + $1.y } / CGFloat(points.count))
    var xx: CGFloat = 0, xy: CGFloat = 0, yy: CGFloat = 0
    for point in points {
      let x = point.x - center.x, y = point.y - center.y
      xx += x * x; xy += x * y; yy += y * y
    }
    let theta = 0.5 * atan2(2 * xy, xx - yy)
    let ux = cos(theta), uy = sin(theta)
    let projected = points.map { point -> CGPoint in
      let x = point.x - center.x, y = point.y - center.y
      return CGPoint(x: x * ux + y * uy, y: -x * uy + y * ux)
    }
    let lo = projected.map(\.x).min()!, hi = projected.map(\.x).max()!
    let span = hi - lo
    let crossSpan = projected.map(\.y).max()! - projected.map(\.y).min()!
    guard span > crossSpan * 2 else { return nil }
    let binCount = 80
    var bins = [[CGPoint]](repeating: [], count: binCount)
    for point in projected {
      let index = min(binCount - 1, max(0, Int((point.x - lo) / span * CGFloat(binCount))))
      bins[index].append(point)
    }
    var best: [CGPoint] = [], run: [CGPoint] = []
    for index in 12..<68 {
      let bin = bins[index]
      if bin.count >= 4, let minY = bin.map(\.y).min(), let maxY = bin.map(\.y).max(),
         maxY - minY < crossSpan * 0.10 {
        // Equal weight per section avoids overweighting the dark grip or branding.
        run.append(CGPoint(x: bin.reduce(0) { $0 + $1.x } / CGFloat(bin.count), y: (minY + maxY) / 2))
        if run.count > best.count { best = run }
      } else { run.removeAll(keepingCapacity: true) }
    }
    guard best.count >= 14 else { return nil }
    let meanX = best.reduce(0) { $0 + $1.x } / CGFloat(best.count)
    let meanY = best.reduce(0) { $0 + $1.y } / CGFloat(best.count)
    let variance = best.reduce(0) { $0 + pow($1.x - meanX, 2) }
    guard variance > 0 else { return nil }
    let slope = best.reduce(0) { $0 + ($1.x - meanX) * ($1.y - meanY) } / variance
    let residual = best.map { abs($0.y - meanY - slope * ($0.x - meanX)) }.max() ?? .infinity
    guard residual < max(1.5, span * 0.003), abs(atan(slope)) < .pi / 12 else { return nil }
    return (theta + atan(slope)) * 180 / .pi
  }
}
