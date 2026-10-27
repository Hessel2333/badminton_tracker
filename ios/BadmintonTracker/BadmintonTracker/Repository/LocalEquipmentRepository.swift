import Foundation
import SwiftData

@MainActor
final class LocalEquipmentRepository: EquipmentRepository {
  private let context: ModelContext
  private let store: LocalDataStore

  private let bundle: Bundle

  init(
    container: ModelContainer = BadmintonDataContainer.shared,
    legacyFileURL: URL? = nil,
    bundle: Bundle = .main
  ) {
    context = ModelContext(container)
    context.autosaveEnabled = false
    self.bundle = bundle
    store = LocalDataStore(context: context, legacyFileURL: legacyFileURL, bundle: bundle)
  }

  func fetchCatalogEquipment() async throws -> [CatalogEquipment] {
    try CatalogSeedService(context: context, bundle: bundle).importBundledSeedIfNeeded()
    return try context.fetch(FetchDescriptor<CatalogEquipmentEntity>())
      .filter(\.isActive)
      .map(\.domainModel)
      .sorted(by: Self.catalogSort)
  }

  func searchCatalogEquipment(keyword: String) async throws -> [CatalogEquipment] {
    let normalized = keyword.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalized.isEmpty else { return try await fetchCatalogEquipment() }
    return try await fetchCatalogEquipment().filter { equipment in
      [equipment.name, equipment.brand, equipment.model, equipment.series, equipment.variant]
        .compactMap { $0 }
        .joined(separator: " ")
        .localizedCaseInsensitiveContains(normalized)
        || equipment.tags.contains { $0.localizedCaseInsensitiveContains(normalized) }
    }
  }

  func fetchUserEquipment() async throws -> [UserEquipment] {
    let stringRecords = try context.fetch(FetchDescriptor<StringingRecordEntity>())
    let recordsByOwner = Dictionary(grouping: stringRecords, by: \.userEquipmentID)
    return try context.fetch(FetchDescriptor<UserEquipmentEntity>())
      .filter { $0.deletedAt == nil }
      .map { entity in
        UserEquipment(
          id: entity.id,
          catalogEquipmentID: entity.catalogEquipmentID,
          customName: entity.customName,
          customBrand: entity.customBrand,
          customModel: entity.customModel,
          customVariant: entity.customVariant,
          category: EquipmentCategory(name: entity.categoryRawValue),
          notes: entity.notes,
          profileDetails: entity.profileDetails(stringingRecords: recordsByOwner[entity.id] ?? []),
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt
        )
      }
      .sorted { $0.updatedAt > $1.updatedAt }
  }

  func createUserEquipment(_ equipment: UserEquipment) async throws {
    guard try context.fetch(FetchDescriptor<UserEquipmentEntity>()).contains(where: { $0.id == equipment.id }) == false else {
      try await updateUserEquipment(equipment)
      return
    }
    let entity = UserEquipmentEntity(
      id: equipment.id,
      catalogEquipmentID: equipment.catalogEquipmentID,
      legacyIdentity: nil,
      customName: equipment.customName,
      customBrand: equipment.customBrand,
      customModel: equipment.customModel,
      customVariant: equipment.customVariant,
      category: equipment.category,
      notes: equipment.notes,
      coverImageReference: nil,
      imageKey: nil,
      createdAt: equipment.createdAt,
      updatedAt: equipment.updatedAt
    )
    entity.applyProfileDetails(equipment.profileDetails, context: context)
    context.insert(entity)
    try context.save()
  }

  func updateUserEquipment(_ equipment: UserEquipment) async throws {
    guard let entity = try context.fetch(FetchDescriptor<UserEquipmentEntity>()).first(where: { $0.id == equipment.id }) else {
      try await createUserEquipment(equipment)
      return
    }
    entity.catalogEquipmentID = equipment.catalogEquipmentID
    entity.customName = equipment.customName
    entity.customBrand = equipment.customBrand
    entity.customModel = equipment.customModel
    entity.customVariant = equipment.customVariant
    entity.categoryRawValue = equipment.category.rawValue
    entity.notes = equipment.notes
    entity.updatedAt = equipment.updatedAt
    entity.applyProfileDetails(equipment.profileDetails, context: context)
    try context.save()
  }

  func deleteUserEquipment(id: UUID) async throws {
    let users = try context.fetch(FetchDescriptor<UserEquipmentEntity>())
    users.filter { $0.id == id }.forEach(context.delete)

    let purchases = try context.fetch(FetchDescriptor<PurchaseRecordEntity>())
    purchases.filter { $0.userEquipmentID == id }.forEach(context.delete)

    let stringing = try context.fetch(FetchDescriptor<StringingRecordEntity>())
    stringing.filter { $0.userEquipmentID == id }.forEach(context.delete)

    let media = try context.fetch(FetchDescriptor<MediaAssetEntity>())
      .filter { $0.ownerTypeRawValue == MediaOwnerType.userEquipment.rawValue && $0.ownerID == id }
    for asset in media {
      try? GearPhotoProcessor.deleteMedia(id: asset.id)
      context.delete(asset)
    }
    try context.save()
  }

  func fetchMediaAssets(ownerID: UUID) async throws -> [MediaAsset] {
    try context.fetch(FetchDescriptor<MediaAssetEntity>())
      .filter { $0.ownerID == ownerID }
      .compactMap(\.domainModel)
      .sorted { $0.createdAt < $1.createdAt }
  }

  func fetchAppData() async throws -> LocalAppData { try store.load() }
  func createPurchase(_ input: PurchaseInput) async throws -> LocalAppData { try store.createPurchase(input) }
  func purchaseWishlistItem(id: String, purchaseInput: PurchaseInput) async throws -> LocalAppData {
    try store.purchaseWishlistItem(id: id, purchaseInput: purchaseInput)
  }
  func updateGearItem(id: String, input: GearEditInput) async throws -> LocalAppData {
    try store.updateGearItem(id: id, input: input)
  }
  func updatePurchaseRecord(id: String, input: PurchaseEditInput) async throws -> LocalAppData {
    try store.updatePurchaseRecord(id: id, input: input)
  }
  func deletePurchaseRecord(id: String) async throws -> LocalAppData { try store.deletePurchaseRecord(id: id) }
  func deletePurchaseWithUndo(id: String) async throws -> PurchaseDeletionResult { try store.deletePurchaseWithUndo(id: id) }
  func restorePurchase(_ deletion: PurchaseDeletion) async throws -> LocalAppData { try store.restorePurchase(deletion) }
  func createWishlistItem(_ input: WishlistEditInput) async throws -> LocalAppData { try store.createWishlistItem(input) }
  func updateWishlistItem(id: String, input: WishlistEditInput) async throws -> LocalAppData {
    try store.updateWishlistItem(id: id, input: input)
  }
  func restoreWishlistItem(_ item: WishlistItem) async throws -> LocalAppData { try store.restoreWishlistItem(item) }
  func deleteWishlistItem(id: String) async throws -> LocalAppData { try store.deleteWishlistItem(id: id) }
  func deleteGearItem(id: String) async throws -> LocalAppData { try store.deleteGearItem(id: id) }
  func reset() async throws -> LocalAppData { try store.reset() }
  func exportBackupData() throws -> Data { try store.exportBackupData() }
  func exportBackupPackage() throws -> FileWrapper { try store.exportBackupPackage() }
  func exportBackupPackageData() throws -> Data { try store.exportBackupPackageData() }
  func importBackupData(_ data: Data) async throws -> LocalAppData { try store.importBackupData(data) }
  func importBackupPackage(at url: URL) async throws -> LocalAppData { try store.importBackupPackage(at: url) }
  func importBackupPackageData(_ data: Data) async throws -> LocalAppData { try store.importBackupPackageData(data) }

  private static func catalogSort(_ left: CatalogEquipment, _ right: CatalogEquipment) -> Bool {
    if left.category == right.category {
      return left.popularity > right.popularity
    }
    return left.category.rawValue < right.category.rawValue
  }
}
