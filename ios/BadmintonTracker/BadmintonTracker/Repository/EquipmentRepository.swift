import Foundation

@MainActor
protocol EquipmentRepository {
  func fetchCatalogEquipment() async throws -> [CatalogEquipment]
  func searchCatalogEquipment(keyword: String) async throws -> [CatalogEquipment]
  func fetchUserEquipment() async throws -> [UserEquipment]
  func createUserEquipment(_ equipment: UserEquipment) async throws
  func updateUserEquipment(_ equipment: UserEquipment) async throws
  func deleteUserEquipment(id: UUID) async throws
  func fetchMediaAssets(ownerID: UUID) async throws -> [MediaAsset]

  // Existing feature-facing operations stay at this boundary so SwiftUI never
  // needs to know whether the implementation is SwiftData-only or hybrid.
  func fetchAppData() async throws -> LocalAppData
  func createPurchase(_ input: PurchaseInput) async throws -> LocalAppData
  func purchaseWishlistItem(id: String, purchaseInput: PurchaseInput) async throws -> LocalAppData
  func updateGearItem(id: String, input: GearEditInput) async throws -> LocalAppData
  func updatePurchaseRecord(id: String, input: PurchaseEditInput) async throws -> LocalAppData
  func createWishlistItem(_ input: WishlistEditInput) async throws -> LocalAppData
  func updateWishlistItem(id: String, input: WishlistEditInput) async throws -> LocalAppData
  func restoreWishlistItem(_ item: WishlistItem) async throws -> LocalAppData
  func deleteWishlistItem(id: String) async throws -> LocalAppData
  func deleteGearItem(id: String) async throws -> LocalAppData
  func reset() async throws -> LocalAppData

  func exportBackupData() throws -> Data
  func exportBackupPackage() throws -> FileWrapper
  func exportBackupPackageData() throws -> Data
  func importBackupData(_ data: Data) async throws -> LocalAppData
  func importBackupPackage(at url: URL) async throws -> LocalAppData
  func importBackupPackageData(_ data: Data) async throws -> LocalAppData
}

extension EquipmentRepository {
  func restoreWishlistItem(_ item: WishlistItem) async throws -> LocalAppData {
    throw CocoaError(.featureUnsupported)
  }
}
