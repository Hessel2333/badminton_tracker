import Foundation

struct LocalMediaFiles: Hashable, Sendable {
  let id: UUID
  let originalRelativePath: String?
  let processedRelativePath: String?
  let thumbnailRelativePath: String?
}

protocol MediaStorage {
  func makeAssetDirectory(id: UUID) throws -> URL
  func relativePath(for url: URL) -> String?
  func fileURL(forRelativePath path: String) -> URL?
  func reference(forRelativePath path: String) -> String
  func relativePath(fromReference reference: String) -> String?
  func files(forReference reference: String) -> LocalMediaFiles?
  func removeAsset(id: UUID) throws
}
