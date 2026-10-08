import Foundation

enum EquipmentCategory: String, Codable, CaseIterable, Sendable {
  case shuttle = "羽毛球"
  case racket = "球拍"
  case shoes = "球鞋"
  case other = "其他"

  init(name: String) {
    self = Self.allCases.first(where: { $0.rawValue == name }) ?? .other
  }
}

struct CatalogEquipment: Codable, Identifiable, Hashable, Sendable {
  let id: UUID
  var name: String
  var brand: String
  var model: String?
  var series: String?
  var category: EquipmentCategory
  var variant: String?
  var weightClass: String?
  var gripSize: String?
  var color: String?
  var releaseYear: Int?
  var suggestedUnitPriceCny: Double?
  var imageKey: String?
  var popularity: Int
  var tags: [String]
  var revision: Int
  var isActive: Bool
  var createdAt: Date
  var updatedAt: Date
}

struct CatalogSeedFile: Codable, Sendable {
  let version: Int
  let equipment: [CatalogEquipment]
}

struct UserEquipment: Identifiable, Hashable {
  let id: UUID
  var catalogEquipmentID: UUID?
  var customName: String
  var customBrand: String?
  var customModel: String?
  var customVariant: String?
  var category: EquipmentCategory
  var notes: String?
  var profileDetails: GearProfileDetails?
  var createdAt: Date
  var updatedAt: Date
}

enum MediaOwnerType: String, Codable, Sendable {
  case catalogEquipment
  case userEquipment
  case wishlist
}

enum MediaSourceType: String, Codable, Sendable {
  case bundle
  case userImported
  case remote
}

struct MediaAsset: Identifiable, Hashable, Sendable {
  let id: UUID
  var ownerType: MediaOwnerType
  var ownerID: UUID
  var sourceType: MediaSourceType
  var localOriginalPath: String?
  var localProcessedPath: String?
  var localThumbnailPath: String?
  var remoteOriginalURL: URL?
  var remoteProcessedURL: URL?
  var remoteThumbnailURL: URL?
  var processingVersion: Int?
  var createdAt: Date
  var updatedAt: Date
}

enum StableUUID {
  /// Keeps legacy non-UUID identifiers stable during the one-time JSON migration.
  static func from(_ value: String) -> UUID {
    if let uuid = UUID(uuidString: value) {
      return uuid
    }

    // FNV-1a is sufficient here because this is a deterministic migration key,
    // not a security primitive. Two differently-seeded hashes fill 128 bits.
    let bytes = Array(value.utf8)
    let first = fnv1a(bytes, seed: 0xcbf29ce484222325)
    let second = fnv1a(bytes.reversed(), seed: 0x84222325cbf29ce4)
    var uuidBytes = withUnsafeBytes(of: first.bigEndian, Array.init)
      + withUnsafeBytes(of: second.bigEndian, Array.init)
    uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x50
    uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80
    let tuple: uuid_t = (
      uuidBytes[0], uuidBytes[1], uuidBytes[2], uuidBytes[3],
      uuidBytes[4], uuidBytes[5], uuidBytes[6], uuidBytes[7],
      uuidBytes[8], uuidBytes[9], uuidBytes[10], uuidBytes[11],
      uuidBytes[12], uuidBytes[13], uuidBytes[14], uuidBytes[15]
    )
    return UUID(uuid: tuple)
  }

  private static func fnv1a<S: Sequence>(_ bytes: S, seed: UInt64) -> UInt64 where S.Element == UInt8 {
    bytes.reduce(seed) { hash, byte in
      (hash ^ UInt64(byte)) &* 0x100000001b3
    }
  }
}
