import Foundation
import SwiftData

enum CatalogSeedError: LocalizedError {
  case missingBundleResource

  var errorDescription: String? {
    "内置装备库暂时无法读取。"
  }
}

@MainActor
struct CatalogSeedService {
  static let metadataKey = "catalogSeedVersion"

  let context: ModelContext
  var bundle: Bundle = .main

  @discardableResult
  func importBundledSeedIfNeeded() throws -> Bool {
    let seed = try bundledSeed()
    let metadata = try context.fetch(FetchDescriptor<AppMetadataEntity>())
      .first(where: { $0.key == Self.metadataKey })
    guard (metadata?.integerValue ?? 0) < seed.version else {
      return false
    }

    try apply(seed, metadata: metadata)
    return true
  }

  func bundledSeed() throws -> CatalogSeedFile {
    guard let url = bundle.url(
      forResource: "equipment_catalog",
      withExtension: "json",
      subdirectory: "Seed"
    ) else {
      throw CatalogSeedError.missingBundleResource
    }
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    return try decoder.decode(CatalogSeedFile.self, from: Data(contentsOf: url))
  }

  func apply(_ seed: CatalogSeedFile, metadata: AppMetadataEntity? = nil) throws {
    let existing = try context.fetch(FetchDescriptor<CatalogEquipmentEntity>())
    let existingByID = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
    let seedIDs = Set(seed.equipment.map(\.id))
    let now = Date()

    for equipment in seed.equipment {
      if let entity = existingByID[equipment.id] {
        entity.apply(equipment)
        entity.sourceRawValue = "bundle"
      } else {
        context.insert(CatalogEquipmentEntity(equipment: equipment))
      }
      upsertBundleMedia(for: equipment, now: now)
    }

    // Missing items are retired rather than deleted. Optional UUID links from
    // user equipment therefore remain valid and all personal data is untouched.
    for entity in existing where entity.sourceRawValue == "bundle" && !seedIDs.contains(entity.id) {
      entity.isActive = false
      entity.updatedAt = now
    }

    if let metadata {
      metadata.integerValue = seed.version
      metadata.updatedAt = now
    } else {
      context.insert(AppMetadataEntity(
        key: Self.metadataKey,
        integerValue: seed.version,
        updatedAt: now
      ))
    }
    try context.save()
  }

  private func upsertBundleMedia(for equipment: CatalogEquipment, now: Date) {
    guard let imageKey = equipment.imageKey else { return }
    let mediaID = StableUUID.from("catalog-media:\(equipment.id.uuidString)")
    let descriptor = FetchDescriptor<MediaAssetEntity>()
    let existing = (try? context.fetch(descriptor))?.first(where: { $0.id == mediaID })
    let relativeResourcePath = "Bundle/GearImages/\(imageKey)"

    if let existing {
      existing.ownerID = equipment.id
      existing.localProcessedPath = relativeResourcePath
      existing.updatedAt = now
      return
    }

    context.insert(MediaAssetEntity(asset: MediaAsset(
      id: mediaID,
      ownerType: .catalogEquipment,
      ownerID: equipment.id,
      sourceType: .bundle,
      localOriginalPath: nil,
      localProcessedPath: relativeResourcePath,
      localThumbnailPath: nil,
      remoteOriginalURL: nil,
      remoteProcessedURL: nil,
      remoteThumbnailURL: nil,
      processingVersion: 1,
      createdAt: equipment.createdAt,
      updatedAt: now
    )))
  }
}
