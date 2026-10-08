import Foundation
import UIKit
import ImageIO

struct GearImageResolver {
  nonisolated(unsafe) private static let localImageCache: NSCache<NSString, UIImage> = {
    let cache = NSCache<NSString, UIImage>()
    cache.totalCostLimit = 64 * 1024 * 1024
    cache.countLimit = 100
    return cache
  }()
  nonisolated(unsafe) private static let pegboardImageCache = NSCache<NSString, UIImage>()

  nonisolated(unsafe) private static let shuttleCache = NSCache<NSString, ShuttlePegboardAsset>()

  static func localImageURL(imageKey: String?, coverImageUrl: String?) -> URL? {
    let manifest = GearImageManifest.shared
    for key in candidateKeys(imageKey: imageKey, coverImageUrl: coverImageUrl) {
      if let fileName = manifest.fileName(for: key),
         let url = Bundle.main.url(forResource: fileName, withExtension: nil, subdirectory: "GearImages") {
        return url
      }
    }
    if let url = localPhotoURL(for: coverImageUrl) {
      return url
    }
    if let url = absoluteURL(for: coverImageUrl), url.isFileURL {
      return url
    }
    return nil
  }

  static func localImage(imageKey: String?, coverImageUrl: String?) -> UIImage? {
    guard let url = localImageURL(imageKey: imageKey, coverImageUrl: coverImageUrl) else {
      return nil
    }
    let cacheKey = url.absoluteString as NSString
    if let cached = localImageCache.object(forKey: cacheKey) {
      return cached
    }
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 2048,
            kCGImageSourceShouldCacheImmediately: true
          ] as CFDictionary) else { return nil }
    let image = UIImage(cgImage: thumbnail)
    localImageCache.setObject(image, forKey: cacheKey, cost: thumbnail.bytesPerRow * thumbnail.height)
    return image
  }

  static func preferredImageURL(imageKey: String?, coverImageUrl: String?) -> URL? {
    localImageURL(imageKey: imageKey, coverImageUrl: coverImageUrl)
      ?? absoluteURL(for: coverImageUrl)
  }

  static func pegboardImage(imageKey: String?, coverImageUrl: String?, categoryName: String) -> UIImage? {
    if categoryName.contains("羽毛球") {
      return shuttleAsset(imageKey: imageKey, coverImageUrl: coverImageUrl)?.image
    }
    guard categoryName.contains("球拍"),
          let image = localImage(imageKey: imageKey, coverImageUrl: coverImageUrl) else {
      return nil
    }

    let cacheKey = [
      categoryName,
      imageKey ?? "",
      coverImageUrl ?? "",
      "\(Int(image.size.width))x\(Int(image.size.height))"
    ].joined(separator: "|") as NSString
    if let cached = pegboardImageCache.object(forKey: cacheKey) {
      return cached
    }

    let resolved = normalizedRacketImage(image) ?? image
    pegboardImageCache.setObject(resolved, forKey: cacheKey)
    return resolved
  }

  static func shuttleAsset(imageKey: String?, coverImageUrl: String?) -> ShuttlePegboardAsset? {
    guard let url = localImageURL(imageKey: imageKey, coverImageUrl: coverImageUrl) else { return nil }
    let key = url.absoluteString as NSString
    if let cached = shuttleCache.object(forKey: key) { return cached }
    guard let original = localImage(imageKey: imageKey, coverImageUrl: coverImageUrl) else { return nil }
    var image = original
    var geometry: ShuttleTubeGeometry?
    if let cgImage = original.cgImage, let measured = ShuttleTubeGeometry.measure(cgImage),
       let cropped = cgImage.cropping(to: measured.bounds) {
      image = UIImage(cgImage: cropped, scale: original.scale, orientation: .up)
      geometry = measured
    }
    let asset = ShuttlePegboardAsset(image: image, geometry: geometry)
    shuttleCache.setObject(asset, forKey: key)
    return asset
  }

  private static func candidateKeys(imageKey: String?, coverImageUrl: String?) -> [String] {
    var keys: [String] = []
    if let imageKey, !imageKey.isEmpty {
      keys.append(imageKey)
    }

    if let coverImageUrl,
       let fileName = coverImageUrl.split(separator: "/").last {
      let key = String(fileName).replacingOccurrences(of: #"\.[a-zA-Z0-9]+$"#, with: "", options: .regularExpression)
      keys.append(key)
    }

    return Array(NSOrderedSet(array: keys)) as? [String] ?? keys
  }

  private static func absoluteURL(for value: String?) -> URL? {
    guard let value, !value.isEmpty else { return nil }
    if let localURL = localPhotoURL(for: value) {
      return localURL
    }
    guard let url = URL(string: value), url.scheme != nil else { return nil }
    return url
  }

  private static func localPhotoURL(for value: String?) -> URL? {
    guard let value, !value.isEmpty else { return nil }
    return GearPhotoProcessor.photoURL(for: value)
  }

  private static func normalizedRacketImage(_ image: UIImage) -> UIImage? {
    guard let cutout = transparentCutout(from: image),
          let metrics = measureContentMetrics(in: cutout) else {
      return nil
    }

    let shaftAngle = cutout.cgImage.flatMap { RacketAxisGeometry.angle(in: $0) }
    let correction = autoRotateForRacket(ImageContentMetrics(
      majorAxisAngleDeg: shaftAngle ?? metrics.majorAxisAngleDeg
    ))
    let upright = abs(correction) > 0.4 ? rotatedImage(cutout, degrees: correction) : cutout
    return trimTransparent(from: upright) ?? upright
  }

  private static func autoRotateForRacket(_ metrics: ImageContentMetrics) -> CGFloat {
    clamp(normalize180(90 - metrics.majorAxisAngleDeg), min: -75, max: 75)
  }

  private static func normalize180(_ angle: CGFloat) -> CGFloat {
    let firstWrap = (angle + 90).truncatingRemainder(dividingBy: 180)
    let positiveWrap = (firstWrap + 180).truncatingRemainder(dividingBy: 180)
    return positiveWrap - 90
  }

  private static func clamp(_ value: CGFloat, min: CGFloat, max: CGFloat) -> CGFloat {
    Swift.min(max, Swift.max(min, value))
  }

  private static func transparentCutout(from image: UIImage) -> UIImage? {
    guard let rendered = rgbaPixels(from: image) else { return nil }
    var pixels = rendered.pixels

    var index = 0
    while index < pixels.count {
      let red = pixels[index]
      let green = pixels[index + 1]
      let blue = pixels[index + 2]
      let alpha = pixels[index + 3]
      if shouldDiscardPixel(red: red, green: green, blue: blue, alpha: alpha) {
        pixels[index] = 0
        pixels[index + 1] = 0
        pixels[index + 2] = 0
        pixels[index + 3] = 0
      }
      index += 4
    }

    return imageFromPixels(
      pixels,
      width: rendered.width,
      height: rendered.height,
      scale: image.scale
    )
  }

  private static func rotatedImage(_ image: UIImage, degrees: CGFloat) -> UIImage {
    let radians = degrees * .pi / 180
    let originalSize = image.size
    let rotatedBounds = CGRect(origin: .zero, size: originalSize)
      .applying(CGAffineTransform(rotationAngle: radians))
      .integral

    let format = UIGraphicsImageRendererFormat()
    format.scale = image.scale
    format.opaque = false
    let renderer = UIGraphicsImageRenderer(size: rotatedBounds.size, format: format)
    return renderer.image { context in
      let cgContext = context.cgContext
      cgContext.translateBy(x: rotatedBounds.size.width / 2, y: rotatedBounds.size.height / 2)
      cgContext.rotate(by: radians)
      image.draw(in: CGRect(
        x: -originalSize.width / 2,
        y: -originalSize.height / 2,
        width: originalSize.width,
        height: originalSize.height
      ))
    }
  }

  private static func trimTransparent(from image: UIImage) -> UIImage? {
    guard let rendered = rgbaPixels(from: image) else { return nil }
    let pixels = rendered.pixels
    var minX = rendered.width
    var minY = rendered.height
    var maxX = -1
    var maxY = -1

    for y in 0..<rendered.height {
      for x in 0..<rendered.width {
        let index = y * rendered.bytesPerRow + x * 4
        if pixels[index + 3] > 12 {
          minX = Swift.min(minX, x)
          minY = Swift.min(minY, y)
          maxX = Swift.max(maxX, x)
          maxY = Swift.max(maxY, y)
        }
      }
    }

    guard maxX >= minX, maxY >= minY, let cgImage = image.cgImage else {
      return image
    }

    let inset = 6
    let cropX = Swift.max(0, minX - inset)
    let cropY = Swift.max(0, minY - inset)
    let cropWidth = Swift.min(rendered.width - cropX, maxX - minX + 1 + inset * 2)
    let cropHeight = Swift.min(rendered.height - cropY, maxY - minY + 1 + inset * 2)
    guard let cropped = cgImage.cropping(to: CGRect(x: cropX, y: cropY, width: cropWidth, height: cropHeight)) else {
      return image
    }
    return UIImage(cgImage: cropped, scale: image.scale, orientation: .up)
  }

  private static func measureContentMetrics(in image: UIImage) -> ImageContentMetrics? {
    guard let rendered = rgbaPixels(from: image) else { return nil }
    let pixels = rendered.pixels
    let sampleStep = Swift.max(1, Swift.max(rendered.width, rendered.height) / 520)
    var minX = rendered.width
    var minY = rendered.height
    var maxX = -1
    var maxY = -1
    var points: [(Double, Double)] = []
    var sumX = 0.0
    var sumY = 0.0

    stride(from: 0, to: rendered.height, by: sampleStep).forEach { y in
      stride(from: 0, to: rendered.width, by: sampleStep).forEach { x in
        let index = y * rendered.bytesPerRow + x * 4
        let red = pixels[index]
        let green = pixels[index + 1]
        let blue = pixels[index + 2]
        let alpha = pixels[index + 3]
        guard !shouldDiscardPixel(red: red, green: green, blue: blue, alpha: alpha) else {
          return
        }

        minX = Swift.min(minX, x)
        minY = Swift.min(minY, y)
        maxX = Swift.max(maxX, x)
        maxY = Swift.max(maxY, y)
        let point = (Double(x), Double(y))
        points.append(point)
        sumX += point.0
        sumY += point.1
      }
    }

    guard maxX >= minX, maxY >= minY else { return nil }
    let fallbackAngle: CGFloat = (maxX - minX) >= (maxY - minY) ? 0 : 90
    guard points.count >= 64 else {
      return ImageContentMetrics(majorAxisAngleDeg: fallbackAngle)
    }

    let centerX = sumX / Double(points.count)
    let centerY = sumY / Double(points.count)
    var covarianceXX = 0.0
    var covarianceXY = 0.0
    var covarianceYY = 0.0

    for point in points {
      let dx = point.0 - centerX
      let dy = point.1 - centerY
      covarianceXX += dx * dx
      covarianceXY += dx * dy
      covarianceYY += dy * dy
    }

    let theta = 0.5 * atan2(2 * covarianceXY, covarianceXX - covarianceYY)
    return ImageContentMetrics(majorAxisAngleDeg: CGFloat(theta * 180 / .pi))
  }

  private static func rgbaPixels(from image: UIImage) -> RenderedPixels? {
    guard let cgImage = image.cgImage else { return nil }
    let width = cgImage.width
    let height = cgImage.height
    let bytesPerRow = width * 4
    var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: bitmapInfo
          ) else {
      return nil
    }

    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    return RenderedPixels(width: width, height: height, bytesPerRow: bytesPerRow, pixels: pixels)
  }

  private static func imageFromPixels(_ pixels: [UInt8], width: Int, height: Int, scale: CGFloat) -> UIImage? {
    let bytesPerRow = width * 4
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let provider = CGDataProvider(data: Data(pixels) as CFData),
          let cgImage = CGImage(
            width: width,
            height: height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGBitmapInfo(rawValue: bitmapInfo),
            provider: provider,
            decode: nil,
            shouldInterpolate: true,
            intent: .defaultIntent
          ) else {
      return nil
    }

    return UIImage(cgImage: cgImage, scale: scale, orientation: .up)
  }

  private static func shouldDiscardPixel(red: UInt8, green: UInt8, blue: UInt8, alpha: UInt8) -> Bool {
    alpha < 12 || (alpha > 220 && red >= 246 && green >= 246 && blue >= 246)
  }
}

private struct ImageContentMetrics {
  let majorAxisAngleDeg: CGFloat
}

private struct RenderedPixels {
  let width: Int
  let height: Int
  let bytesPerRow: Int
  let pixels: [UInt8]
}

private struct GearImageManifestFile: Decodable {
  let images: [String: String]
}

private struct GearImageManifest: Sendable {
  static let shared = GearImageManifest()

  private let images: [String: String]

  private init() {
    guard let url = Bundle.main.url(forResource: "gear-image-manifest", withExtension: "json", subdirectory: "GearImages"),
          let data = try? Data(contentsOf: url),
          let manifest = try? JSONDecoder().decode(GearImageManifestFile.self, from: data) else {
      images = [:]
      return
    }
    images = manifest.images
  }

  func fileName(for key: String) -> String? {
    images[key]
  }
}

final class ShuttlePegboardAsset: NSObject {
  let image: UIImage
  let geometry: ShuttleTubeGeometry?

  init(image: UIImage, geometry: ShuttleTubeGeometry?) {
    self.image = image
    self.geometry = geometry
  }
}
