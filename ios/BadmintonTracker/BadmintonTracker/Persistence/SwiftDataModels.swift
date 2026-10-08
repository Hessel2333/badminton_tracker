import Foundation
import SwiftData

@Model
final class CatalogEquipmentEntity {
  @Attribute(.unique) var id: UUID
  var name: String
  var brand: String
  var model: String?
  var series: String?
  var categoryRawValue: String
  var variant: String?
  var weightClass: String?
  var gripSize: String?
  var color: String?
  var releaseYear: Int?
  var suggestedUnitPriceCny: Double?
  var imageKey: String?
  var popularity: Int
  var tagsData: Data
  var revision: Int
  var isActive: Bool
  var sourceRawValue: String
  var createdAt: Date
  var updatedAt: Date

  init(equipment: CatalogEquipment, source: String = "bundle") {
    id = equipment.id
    name = equipment.name
    brand = equipment.brand
    model = equipment.model
    series = equipment.series
    categoryRawValue = equipment.category.rawValue
    variant = equipment.variant
    weightClass = equipment.weightClass
    gripSize = equipment.gripSize
    color = equipment.color
    releaseYear = equipment.releaseYear
    suggestedUnitPriceCny = equipment.suggestedUnitPriceCny
    imageKey = equipment.imageKey
    popularity = equipment.popularity
    tagsData = (try? JSONEncoder().encode(equipment.tags)) ?? Data()
    revision = equipment.revision
    isActive = equipment.isActive
    sourceRawValue = source
    createdAt = equipment.createdAt
    updatedAt = equipment.updatedAt
  }

  var domainModel: CatalogEquipment {
    CatalogEquipment(
      id: id,
      name: name,
      brand: brand,
      model: model,
      series: series,
      category: EquipmentCategory(name: categoryRawValue),
      variant: variant,
      weightClass: weightClass,
      gripSize: gripSize,
      color: color,
      releaseYear: releaseYear,
      suggestedUnitPriceCny: suggestedUnitPriceCny,
      imageKey: imageKey,
      popularity: popularity,
      tags: (try? JSONDecoder().decode([String].self, from: tagsData)) ?? [],
      revision: revision,
      isActive: isActive,
      createdAt: createdAt,
      updatedAt: updatedAt
    )
  }

  func apply(_ equipment: CatalogEquipment) {
    name = equipment.name
    brand = equipment.brand
    model = equipment.model
    series = equipment.series
    categoryRawValue = equipment.category.rawValue
    variant = equipment.variant
    weightClass = equipment.weightClass
    gripSize = equipment.gripSize
    color = equipment.color
    releaseYear = equipment.releaseYear
    suggestedUnitPriceCny = equipment.suggestedUnitPriceCny
    imageKey = equipment.imageKey
    popularity = equipment.popularity
    tagsData = (try? JSONEncoder().encode(equipment.tags)) ?? Data()
    revision = equipment.revision
    isActive = equipment.isActive
    updatedAt = equipment.updatedAt
  }
}

@Model
final class UserEquipmentEntity {
  @Attribute(.unique) var id: UUID
  var catalogEquipmentID: UUID?
  var legacyIdentity: String?
  var customName: String
  var customBrand: String?
  var customModel: String?
  var customVariant: String?
  var categoryRawValue: String
  var notes: String?
  var coverImageReference: String?
  var imageKey: String?
  var profileTypeRawValue: String?
  var shuttleBallsPerTube: Int?
  var shuttleSpeed: String?
  var racketWeightSpec: String?
  var racketGripSpec: String?
  var shoesSize: String?
  var shoesSizeSystem: String?
  var shoesColorway: String?
  var otherNote: String?
  var createdAt: Date
  var updatedAt: Date
  var deletedAt: Date?

  init(
    id: UUID,
    catalogEquipmentID: UUID?,
    legacyIdentity: String?,
    customName: String,
    customBrand: String?,
    customModel: String?,
    customVariant: String?,
    category: EquipmentCategory,
    notes: String?,
    coverImageReference: String?,
    imageKey: String?,
    createdAt: Date,
    updatedAt: Date
  ) {
    self.id = id
    self.catalogEquipmentID = catalogEquipmentID
    self.legacyIdentity = legacyIdentity
    self.customName = customName
    self.customBrand = customBrand
    self.customModel = customModel
    self.customVariant = customVariant
    categoryRawValue = category.rawValue
    self.notes = notes
    self.coverImageReference = coverImageReference
    self.imageKey = imageKey
    self.createdAt = createdAt
    self.updatedAt = updatedAt
  }
}

@Model
final class PurchaseRecordEntity {
  @Attribute(.unique) var id: UUID
  var userEquipmentID: UUID
  var itemNameSnapshot: String
  var brandNameSnapshot: String?
  var categoryNameSnapshot: String?
  var unitPriceCny: Double
  var quantity: Int
  var totalPriceCny: Double
  var itemStatusRawValue: String
  var purchaseDate: String
  var consumptionRecordsData: Data?
  var statusDate: String?
  var channel: String?
  var notes: String?

  init(id: UUID, userEquipmentID: UUID, record: PurchaseRecord) {
    self.id = id
    self.userEquipmentID = userEquipmentID
    itemNameSnapshot = record.itemNameSnapshot
    brandNameSnapshot = record.brand?.name
    categoryNameSnapshot = record.category?.name
    unitPriceCny = record.unitPriceCny
    quantity = record.quantity
    totalPriceCny = record.totalPriceCny
    itemStatusRawValue = record.itemStatus.rawValue
    purchaseDate = record.purchaseDate
    consumptionRecordsData = try? JSONEncoder().encode(record.consumptionRecords)
    statusDate = record.statusDate
    channel = record.channel
    notes = record.notes
  }

  func apply(_ record: PurchaseRecord) {
    itemNameSnapshot = record.itemNameSnapshot
    brandNameSnapshot = record.brand?.name
    categoryNameSnapshot = record.category?.name
    unitPriceCny = record.unitPriceCny
    quantity = record.quantity
    totalPriceCny = record.totalPriceCny
    itemStatusRawValue = record.itemStatus.rawValue
    purchaseDate = record.purchaseDate
    consumptionRecordsData = try? JSONEncoder().encode(record.consumptionRecords)
    statusDate = record.statusDate
    channel = record.channel
    notes = record.notes
  }
}

@Model
final class StringingRecordEntity {
  @Attribute(.unique) var id: UUID
  var userEquipmentID: UUID
  var stringName: String?
  var mainTension: Double?
  var crossTension: Double?
  var stringingDate: String?
  var costCny: Double?
  var channel: String?
  var notes: String?
  var createdAt: Date
  var updatedAt: Date

  init(id: UUID, userEquipmentID: UUID, record: StringingRecord, now: Date = Date()) {
    self.id = id
    self.userEquipmentID = userEquipmentID
    stringName = record.stringName
    mainTension = record.mainTension
    crossTension = record.crossTension
    stringingDate = record.stringingDate
    costCny = record.costCny
    channel = record.channel
    notes = record.notes
    createdAt = now
    updatedAt = now
  }

  func apply(_ record: StringingRecord, now: Date = Date()) {
    stringName = record.stringName
    mainTension = record.mainTension
    crossTension = record.crossTension
    stringingDate = record.stringingDate
    costCny = record.costCny
    channel = record.channel
    notes = record.notes
    updatedAt = now
  }
}

@Model
final class MediaAssetEntity {
  @Attribute(.unique) var id: UUID
  var ownerTypeRawValue: String
  var ownerID: UUID
  var sourceTypeRawValue: String
  var localOriginalPath: String?
  var localProcessedPath: String?
  var localThumbnailPath: String?
  var remoteOriginalURLString: String?
  var remoteProcessedURLString: String?
  var remoteThumbnailURLString: String?
  var processingVersion: Int?
  var createdAt: Date
  var updatedAt: Date

  init(asset: MediaAsset) {
    id = asset.id
    ownerTypeRawValue = asset.ownerType.rawValue
    ownerID = asset.ownerID
    sourceTypeRawValue = asset.sourceType.rawValue
    localOriginalPath = asset.localOriginalPath
    localProcessedPath = asset.localProcessedPath
    localThumbnailPath = asset.localThumbnailPath
    remoteOriginalURLString = asset.remoteOriginalURL?.absoluteString
    remoteProcessedURLString = asset.remoteProcessedURL?.absoluteString
    remoteThumbnailURLString = asset.remoteThumbnailURL?.absoluteString
    processingVersion = asset.processingVersion
    createdAt = asset.createdAt
    updatedAt = asset.updatedAt
  }

  var domainModel: MediaAsset? {
    guard let ownerType = MediaOwnerType(rawValue: ownerTypeRawValue),
          let sourceType = MediaSourceType(rawValue: sourceTypeRawValue) else {
      return nil
    }
    return MediaAsset(
      id: id,
      ownerType: ownerType,
      ownerID: ownerID,
      sourceType: sourceType,
      localOriginalPath: localOriginalPath,
      localProcessedPath: localProcessedPath,
      localThumbnailPath: localThumbnailPath,
      remoteOriginalURL: remoteOriginalURLString.flatMap(URL.init(string:)),
      remoteProcessedURL: remoteProcessedURLString.flatMap(URL.init(string:)),
      remoteThumbnailURL: remoteThumbnailURLString.flatMap(URL.init(string:)),
      processingVersion: processingVersion,
      createdAt: createdAt,
      updatedAt: updatedAt
    )
  }
}

@Model
final class WishlistItemEntity {
  @Attribute(.unique) var id: UUID
  var name: String
  var targetPriceCny: Double?
  var currentSeenPriceCny: Double?
  var priceRecordedAt: String?
  var priority: Int
  var statusRawValue: String
  var sourceURLString: String?
  var imageReference: String?
  var notes: String?
  var brandName: String?
  var categoryName: String?

  init(id: UUID, item: WishlistItem) {
    self.id = id
    name = item.name
    targetPriceCny = item.targetPriceCny
    currentSeenPriceCny = item.currentSeenPriceCny
    priceRecordedAt = item.priceRecordedAt
    priority = item.priority
    statusRawValue = item.status.rawValue
    sourceURLString = item.sourceUrl
    imageReference = item.imageUrl
    notes = item.notes
    brandName = item.brand?.name
    categoryName = item.category?.name
  }

  func apply(_ item: WishlistItem) {
    name = item.name
    targetPriceCny = item.targetPriceCny
    currentSeenPriceCny = item.currentSeenPriceCny
    priceRecordedAt = item.priceRecordedAt
    priority = item.priority
    statusRawValue = item.status.rawValue
    sourceURLString = item.sourceUrl
    imageReference = item.imageUrl
    notes = item.notes
    brandName = item.brand?.name
    categoryName = item.category?.name
  }
}

@Model
final class PegboardLayoutEntity {
  @Attribute(.unique) var key: String
  var valueData: Data

  init(key: String = "default", valueData: Data) {
    self.key = key
    self.valueData = valueData
  }
}

@Model
final class AppMetadataEntity {
  @Attribute(.unique) var key: String
  var integerValue: Int?
  var stringValue: String?
  var updatedAt: Date

  init(key: String, integerValue: Int? = nil, stringValue: String? = nil, updatedAt: Date = Date()) {
    self.key = key
    self.integerValue = integerValue
    self.stringValue = stringValue
    self.updatedAt = updatedAt
  }
}

extension UserEquipmentEntity {
  func profileDetails(stringingRecords: [StringingRecordEntity]) -> GearProfileDetails? {
    switch profileTypeRawValue {
    case GearProfileDetails.ProfileType.shuttle.rawValue:
      return .shuttle(ShuttleGearDetails(
        ballsPerTube: shuttleBallsPerTube,
        speed: shuttleSpeed
      ))
    case GearProfileDetails.ProfileType.racket.rawValue:
      let records = stringingRecords.map { entity in
        StringingRecord(
          id: entity.id,
          stringName: entity.stringName,
          mainTension: entity.mainTension,
          crossTension: entity.crossTension,
          stringingDate: entity.stringingDate,
          costCny: entity.costCny,
          channel: entity.channel,
          notes: entity.notes
        )
      }
      return .racket(RacketGearDetails(
        weightSpec: racketWeightSpec,
        gripSpec: racketGripSpec,
        stringHistory: records
      ).refreshedFromStoredHistory())
    case GearProfileDetails.ProfileType.shoes.rawValue:
      return .shoes(ShoesGearDetails(
        size: shoesSize,
        sizeSystem: shoesSizeSystem,
        colorway: shoesColorway
      ))
    case GearProfileDetails.ProfileType.other.rawValue:
      return .other(OtherGearDetails(note: otherNote))
    default:
      return nil
    }
  }

  func applyProfileDetails(_ details: GearProfileDetails?, context: ModelContext) {
    profileTypeRawValue = nil
    shuttleBallsPerTube = nil
    shuttleSpeed = nil
    racketWeightSpec = nil
    racketGripSpec = nil
    shoesSize = nil
    shoesSizeSystem = nil
    shoesColorway = nil
    otherNote = nil

    let allRecords = (try? context.fetch(FetchDescriptor<StringingRecordEntity>())) ?? []
    let ownerRecords = allRecords.filter { $0.userEquipmentID == id }

    switch details {
    case .shuttle(let shuttle):
      profileTypeRawValue = GearProfileDetails.ProfileType.shuttle.rawValue
      shuttleBallsPerTube = shuttle.ballsPerTube
      shuttleSpeed = shuttle.speed
    case .racket(let racket):
      profileTypeRawValue = GearProfileDetails.ProfileType.racket.rawValue
      racketWeightSpec = racket.weightSpec
      racketGripSpec = racket.gripSpec
      let byID = Dictionary(uniqueKeysWithValues: ownerRecords.map { ($0.id, $0) })
      let retainedIDs = Set(racket.stringHistory.map(\.id))
      for record in racket.stringHistory {
        let recordID = record.id
        if let existing = byID[recordID] {
          existing.apply(record)
        } else {
          context.insert(StringingRecordEntity(
            id: recordID,
            userEquipmentID: id,
            record: record
          ))
        }
      }
      ownerRecords.filter { !retainedIDs.contains($0.id) }.forEach(context.delete)
    case .shoes(let shoes):
      profileTypeRawValue = GearProfileDetails.ProfileType.shoes.rawValue
      shoesSize = shoes.size
      shoesSizeSystem = shoes.sizeSystem
      shoesColorway = shoes.colorway
    case .other(let other):
      profileTypeRawValue = GearProfileDetails.ProfileType.other.rawValue
      otherNote = other.note
    case nil:
      break
    }

    if case .racket = details {
      return
    }
    ownerRecords.forEach(context.delete)
  }
}

enum BadmintonTrackerSchemaV1: VersionedSchema {
  static let versionIdentifier = Schema.Version(1, 0, 0)
  static let models: [any PersistentModel.Type] = [
    CatalogEquipmentEntity.self,
    UserEquipmentEntity.self,
    PurchaseRecordEntity.self,
    StringingRecordEntity.self,
    MediaAssetEntity.self,
    WishlistItemEntity.self,
    PegboardLayoutEntity.self,
    AppMetadataEntity.self
  ]
}

enum BadmintonTrackerMigrationPlan: SchemaMigrationPlan {
  static let schemas: [any VersionedSchema.Type] = [BadmintonTrackerSchemaV1.self]
  static let stages: [MigrationStage] = []
}
