import Foundation

struct LocalMediaStorage: MediaStorage {
  static let referenceScheme = "badminton-media"
  private static let legacyReferenceScheme = "badminton-gear-photo"

  let rootURL: URL
  let legacyPhotosURL: URL

  init(rootURL: URL? = nil, legacyPhotosURL: URL? = nil) {
    let supportURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appending(path: "BadmintonTracker", directoryHint: .isDirectory)
    self.rootURL = rootURL ?? supportURL.appending(path: "Media", directoryHint: .isDirectory)
    self.legacyPhotosURL = legacyPhotosURL ?? supportURL.appending(path: "GearPhotos", directoryHint: .isDirectory)
  }

  func makeAssetDirectory(id: UUID) throws -> URL {
    let url = rootURL.appending(path: id.uuidString.lowercased(), directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }

  func relativePath(for url: URL) -> String? {
    let rootPath = rootURL.standardizedFileURL.path
    let filePath = url.standardizedFileURL.path
    guard filePath == rootPath || filePath.hasPrefix(rootPath + "/") else { return nil }
    return String(filePath.dropFirst(rootPath.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
  }

  func fileURL(forRelativePath path: String) -> URL? {
    let cleanPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard !cleanPath.isEmpty, !cleanPath.split(separator: "/").contains("..") else { return nil }
    return rootURL.appending(path: cleanPath)
  }

  func reference(forRelativePath path: String) -> String {
    let cleanPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    return "\(Self.referenceScheme):///\(cleanPath)"
  }

  func relativePath(fromReference reference: String) -> String? {
    guard let components = URLComponents(string: reference),
          components.scheme == Self.referenceScheme else {
      return nil
    }
    let path = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    return path.isEmpty ? nil : path
  }

  func files(forReference reference: String) -> LocalMediaFiles? {
    guard let relativePath = relativePath(fromReference: reference),
          let firstComponent = relativePath.split(separator: "/").first,
          let id = UUID(uuidString: String(firstComponent)) else {
      return nil
    }
    let folder = id.uuidString.lowercased()
    return LocalMediaFiles(
      id: id,
      originalRelativePath: existingRelativePath("\(folder)/original.jpg"),
      processedRelativePath: existingRelativePath("\(folder)/processed.png"),
      thumbnailRelativePath: existingRelativePath("\(folder)/thumbnail.jpg")
    )
  }

  func removeAsset(id: UUID) throws {
    let url = rootURL.appending(path: id.uuidString.lowercased(), directoryHint: .isDirectory)
    guard FileManager.default.fileExists(atPath: url.path) else { return }
    try FileManager.default.removeItem(at: url)
  }

  func resolveReference(_ reference: String) -> URL? {
    if let relativePath = relativePath(fromReference: reference) {
      return fileURL(forRelativePath: relativePath)
    }

    if let url = URL(string: reference), url.scheme == Self.legacyReferenceScheme {
      let fileName = url.lastPathComponent.isEmpty ? url.host : url.lastPathComponent
      guard let fileName, !fileName.isEmpty else { return nil }
      return legacyPhotosURL.appending(path: fileName)
    }

    guard let url = URL(string: reference), url.isFileURL else { return nil }
    if FileManager.default.fileExists(atPath: url.path) {
      return url
    }
    if url.path.contains("GearPhotos") {
      return legacyPhotosURL.appending(path: url.lastPathComponent)
    }
    return nil
  }

  private func existingRelativePath(_ path: String) -> String? {
    guard let url = fileURL(forRelativePath: path),
          FileManager.default.fileExists(atPath: url.path) else {
      return nil
    }
    return path
  }
}
