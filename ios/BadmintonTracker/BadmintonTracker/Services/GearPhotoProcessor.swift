import CoreImage
import ImageIO
import UIKit
import Vision

struct GearPhotoResult {
  let mediaID: UUID
  let originalURL: URL
  let cutoutURL: URL?
  let thumbnailURL: URL?

  var displayURL: URL {
    cutoutURL ?? originalURL
  }

  var displayReference: String {
    GearPhotoProcessor.localPhotoReference(for: displayURL)
  }
}

enum GearPhotoProcessor {
  private static let mediaStorage = LocalMediaStorage()

  static func processImportedImage(_ image: UIImage, categoryName: String? = nil) async throws -> GearPhotoResult {
    try await Task.detached(priority: .userInitiated) {
      let mediaID = UUID()
      let folderURL = try mediaStorage.makeAssetDirectory(id: mediaID)
      var completed = false
      defer { if !completed { try? mediaStorage.removeAsset(id: mediaID) } }
      let original = image.normalizedForStorage(maxPixel: 3000)
      let normalized = image.normalizedForStorage(maxPixel: 1800)
      let originalURL = folderURL.appending(path: "original.jpg")
      let cutoutURL = folderURL.appending(path: "processed.png")
      let thumbnailURL = folderURL.appending(path: "thumbnail.jpg")

      guard let originalData = original.jpegData(compressionQuality: 0.94) else {
        throw GearPhotoError.cannotEncodeImage
      }
      try originalData.write(to: originalURL, options: [.atomic])

      let cutout = try? foregroundCutout(from: normalized, categoryName: categoryName)
      if let cutout,
         let pngData = cutout.pngData() {
        try pngData.write(to: cutoutURL, options: [.atomic])
        try writeThumbnail(from: cutout, to: thumbnailURL)
        completed = true
        return GearPhotoResult(
          mediaID: mediaID,
          originalURL: originalURL,
          cutoutURL: cutoutURL,
          thumbnailURL: thumbnailURL
        )
      }

      try writeThumbnail(from: normalized, to: thumbnailURL)
      completed = true
      return GearPhotoResult(
        mediaID: mediaID,
        originalURL: originalURL,
        cutoutURL: nil,
        thumbnailURL: thumbnailURL
      )
    }.value
  }

  static func localPhotoReference(for url: URL) -> String {
    if let relativePath = mediaStorage.relativePath(for: url) {
      return mediaStorage.reference(forRelativePath: relativePath)
    }
    // Keeps exported backups and existing installations readable.
    return "badminton-gear-photo:///\(url.lastPathComponent)"
  }

  static func photoURL(for reference: String) -> URL? {
    guard !reference.isEmpty else { return nil }
    return mediaStorage.resolveReference(reference)
  }

  static func mediaFiles(for reference: String) -> LocalMediaFiles? {
    mediaStorage.files(forReference: reference)
  }

  static func deleteMedia(id: UUID) throws {
    try mediaStorage.removeAsset(id: id)
  }

  static func originalImage(for reference: String?) -> UIImage? {
    guard let reference, let path = mediaFiles(for: reference)?.originalRelativePath,
          let url = mediaStorage.fileURL(forRelativePath: path) else { return nil }
    return UIImage(contentsOfFile: url.path)
  }

  static func processedImage(for reference: String?) -> UIImage? {
    guard let reference, let path = mediaFiles(for: reference)?.processedRelativePath,
          let url = mediaStorage.fileURL(forRelativePath: path) else { return nil }
    return UIImage(contentsOfFile: url.path)
  }

  static func archiveMedia(for reference: String?) throws -> [String: Data] {
    guard let reference, let files = mediaFiles(for: reference) else { return [:] }
    var archive: [String: Data] = [:]
    for path in [files.originalRelativePath, files.processedRelativePath, files.thumbnailRelativePath].compactMap({ $0 }) {
      if let url = mediaStorage.fileURL(forRelativePath: path) { archive[path] = try Data(contentsOf: url) }
    }
    return archive
  }

  /// Returns only newly created files, so a failed transaction can remove them safely.
  static func restoreMedia(_ archive: [String: Data]) throws -> [URL] {
    var restored: [URL] = []
    do {
      for (path, data) in archive {
        guard let url = mediaStorage.fileURL(forRelativePath: path),
              !FileManager.default.fileExists(atPath: url.path) else { continue }
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
        restored.append(url)
      }
      return restored
    } catch { removeRestoredFiles(restored); throw error }
  }

  static func removeRestoredFiles(_ urls: [URL]) {
    for url in urls { try? FileManager.default.removeItem(at: url) }
  }

  private static func foregroundCutout(from image: UIImage, categoryName: String?) throws -> UIImage {
    guard let cgImage = image.cgImage else {
      throw GearPhotoError.missingCGImage
    }

    if categoryName == "羽毛球", let tube = ShuttleTubeCutout.make(from: cgImage) {
      return UIImage(cgImage: tube, scale: image.scale, orientation: .up)
    }

    let handler = VNImageRequestHandler(
      cgImage: cgImage,
      orientation: CGImagePropertyOrientation(image.imageOrientation),
      options: [:]
    )
    let request = VNGenerateForegroundInstanceMaskRequest()
    try handler.perform([request])

    guard let observation = request.results?.first else {
      throw GearPhotoError.noForeground
    }

    let buffer = try observation.generateMaskedImage(
      ofInstances: observation.allInstances,
      from: handler,
      croppedToInstancesExtent: true
    )

    let ciImage = CIImage(cvPixelBuffer: buffer)
    let context = CIContext(options: [.useSoftwareRenderer: false])
    guard let cutoutCGImage = context.createCGImage(ciImage, from: ciImage.extent) else {
      throw GearPhotoError.cannotEncodeImage
    }
    return UIImage(cgImage: cutoutCGImage, scale: image.scale, orientation: .up)
  }

  static func photoFolderURL() throws -> URL {
    let folderURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appending(path: "BadmintonTracker", directoryHint: .isDirectory)
      .appending(path: "GearPhotos", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: folderURL, withIntermediateDirectories: true)
    return folderURL
  }

  private static func writeThumbnail(from image: UIImage, to url: URL) throws {
    let thumbnail = image.normalizedForStorage(maxPixel: 480)
    guard let data = thumbnail.jpegData(compressionQuality: 0.82) else {
      throw GearPhotoError.cannotEncodeImage
    }
    try data.write(to: url, options: [.atomic])
  }
}

private enum GearPhotoError: LocalizedError {
  case missingCGImage
  case cannotEncodeImage
  case noForeground

  var errorDescription: String? {
    switch self {
    case .missingCGImage:
      "照片暂时无法读取。"
    case .cannotEncodeImage:
      "照片暂时无法保存。"
    case .noForeground:
      "没有识别到清晰的装备主体。"
    }
  }
}

private extension UIImage {
  func normalizedForStorage(maxPixel: CGFloat) -> UIImage {
    let largestSide = max(size.width, size.height)
    let targetScale = min(1, maxPixel / max(largestSide, 1))
    let targetSize = CGSize(width: size.width * targetScale, height: size.height * targetScale)

    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
    return renderer.image { _ in
      UIColor.white.setFill()
      UIBezierPath(rect: CGRect(origin: .zero, size: targetSize)).fill()
      draw(in: CGRect(origin: .zero, size: targetSize))
    }
  }
}

private extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up:
      self = .up
    case .upMirrored:
      self = .upMirrored
    case .down:
      self = .down
    case .downMirrored:
      self = .downMirrored
    case .left:
      self = .left
    case .leftMirrored:
      self = .leftMirrored
    case .right:
      self = .right
    case .rightMirrored:
      self = .rightMirrored
    @unknown default:
      self = .up
    }
  }
}
