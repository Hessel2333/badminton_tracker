import Foundation
import Observation

enum CatalogWishlistAddResult {
  case added
  case alreadyExists
  case failed
}

@MainActor
@Observable
final class AppSession {
  enum UndoOperation {
    case wishlist(WishlistItem)
    case consumption(purchaseID: String, recordID: String, originalStatus: ItemStatus)
  }
  var undoOperation: UndoOperation?
  var isUndoing = false

  func undoLastOperation() async -> Bool {
    guard let operation = undoOperation, !isUndoing else { return false }
    isUndoing = true
    defer { isUndoing = false }
    do {
      switch operation {
      case .wishlist(let item):
        if isDemoMode { wishlistItems.insert(item, at: 0) }
        else { apply(try await repository.restoreWishlistItem(item)) }
      case .consumption(let purchaseID, let recordID, let originalStatus):
        guard let purchase = purchases.first(where: { $0.id == purchaseID }) else {
          throw ConsumptionValidationError.missingPurchase
        }
        let saved = await updatePurchaseRecord(id: purchaseID, input: PurchaseEditInput(
          consumptionRecords: purchase.consumptionHistory.filter { $0.id != recordID },
          unitPriceCny: purchase.unitPriceCny, quantity: purchase.quantity,
          purchaseDate: purchase.purchaseDate, statusDate: purchase.statusDate,
          channel: purchase.channel, itemStatus: purchase.itemStatus == .usedUp ? originalStatus : purchase.itemStatus,
          notes: purchase.notes))
        guard saved else { return false }
      }
      undoOperation = nil
      return true
    } catch { errorMessage = error.localizedDescription; return false }
  }

  var isLoading = false
  var isDemoMode = false
  var hasLoadedInitialData = false
  var errorMessage: String?

  var purchases: [PurchaseRecord] = []
  var gearItems: [GearItem] = []
  var gearWallItems: [GearWallItem] = []
  var pegboardLayouts: PegboardLayoutStore = .empty
  var wishlistItems: [WishlistItem] = []
  var catalogEntries: [LocalGearCatalogEntry] = []
  var analytics: AnalyticsData = .empty
  private let repository: any EquipmentRepository
  private let recoveryURL: URL

  init(repository: (any EquipmentRepository)? = nil, recoveryURL: URL? = nil) {
    self.repository = repository ?? LocalEquipmentRepository()
    self.recoveryURL = recoveryURL ?? Self.recoveryBackupURL
  }

  func enterDemoMode() {
    isDemoMode = true
    hasLoadedInitialData = true
    errorMessage = nil
    purchases = PreviewData.purchases
    gearItems = PreviewData.gearItems
    gearWallItems = PreviewData.gearWallItems
    pegboardLayouts = .empty
    wishlistItems = PreviewData.wishlistItems
    catalogEntries = LocalGearCatalog.entries
    analytics = PreviewData.analytics
  }

  func refreshAll() async {
    if isDemoMode {
      purchases = PreviewData.purchases
      gearItems = PreviewData.gearItems
      gearWallItems = PreviewData.gearWallItems
      pegboardLayouts = .empty
      wishlistItems = PreviewData.wishlistItems
      catalogEntries = LocalGearCatalog.entries
      analytics = PreviewData.analytics
      return
    }

    isLoading = true
    errorMessage = nil
    do {
      let data = try await repository.fetchAppData()
      catalogEntries = try await repository.fetchCatalogEquipment().map(LocalGearCatalogEntry.init)
      apply(data)
    } catch {
      errorMessage = error.localizedDescription
    }
    isLoading = false
  }

  func resetLocalData() async {
    undoOperation = nil
    isLoading = true
    errorMessage = nil
    do {
      let data = try await repository.reset()
      apply(data)
      for key in UserDefaults.standard.dictionaryRepresentation().keys where key.hasPrefix("purchase.draft.") {
        UserDefaults.standard.removeObject(forKey: key)
      }
      isDemoMode = false
    } catch {
      errorMessage = error.localizedDescription
    }
    isLoading = false
  }

  var spendingEntries: [SpendingEntry] { SpendingLedger.entries(purchases: purchases, gear: gearWallItems) }

  func analytics(for range: String) -> AnalyticsData {
    SpendingLedger.analytics(entries: spendingEntries,
      base: LocalDataStore.makeAnalytics(from: purchases, wishlistItems: wishlistItems, range: range), range: range)
  }

  func exportLocalBackupData() throws -> Data {
    try repository.exportBackupData()
  }

  func exportLocalBackupPackage() throws -> FileWrapper {
    try repository.exportBackupPackage()
  }

  func exportLocalBackupPackageData() throws -> Data {
    try repository.exportBackupPackageData()
  }

  static var recoveryBackupURL: URL {
    FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appending(path: "BadmintonTracker/Recovery/before-last-import.btbackup")
  }

  func restorePreparedBackup(_ backup: PreparedBackup) async -> Bool {
    undoOperation = nil
    let recovery: Data
    do {
      recovery = try repository.exportBackupPackageData()
      let url = recoveryURL
      try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      try recovery.write(to: url, options: .atomic)
    } catch {
      errorMessage = "未能保存恢复点，导入已停止。\(error.localizedDescription)"
      return false
    }
    let saved = backup.isLegacy
      ? await importLocalBackupData(backup.data)
      : await importLocalBackupPackageData(backup.data)
    guard !saved else { return true }
    let importError = errorMessage ?? "备份导入失败。"
    let restored = await importLocalBackupPackageData(recovery)
    errorMessage = restored
      ? "\(importError) 已恢复导入前的数据。"
      : "\(importError) 自动恢复未完成，请在设置中导出恢复点并重试。"
    return false
  }

  @discardableResult
  func importLocalBackupData(_ data: Data) async -> Bool {
    isLoading = true
    defer { isLoading = false }
    errorMessage = nil
    do {
      let data = try await repository.importBackupData(data)
      apply(data)
      isDemoMode = false
      return true
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }

  @discardableResult
  func importLocalBackupPackage(at url: URL) async -> Bool {
    isLoading = true
    defer { isLoading = false }
    errorMessage = nil
    do {
      let data = try await repository.importBackupPackage(at: url)
      apply(data)
      isDemoMode = false
      return true
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }

  @discardableResult
  func importLocalBackupPackageData(_ data: Data) async -> Bool {
    isLoading = true
    defer { isLoading = false }
    errorMessage = nil
    do {
      let data = try await repository.importBackupPackageData(data)
      apply(data)
      isDemoMode = false
      return true
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }

  private func apply(_ data: LocalAppData) {
    purchases = data.purchases
    gearItems = data.gearItems
    gearWallItems = data.gearWallItems
    pegboardLayouts = data.pegboardLayouts
    wishlistItems = data.wishlistItems
    analytics = data.analytics
    hasLoadedInitialData = true
  }

  private func clearData() {
    purchases = []
    gearItems = []
    gearWallItems = []
    pegboardLayouts = .empty
    wishlistItems = []
    catalogEntries = []
    analytics = .empty
  }

  @discardableResult
  func createPurchase(_ input: PurchaseInput) async -> Bool {
    if isDemoMode {
      let category = input.categoryName.map { NamedRef(id: UUID().uuidString, name: $0) }
      let created = PurchaseRecord(
        id: UUID().uuidString,
        itemNameSnapshot: input.itemNameSnapshot,
        unitPriceCny: input.unitPriceCny,
        quantity: input.quantity,
        totalPriceCny: input.totalPriceCny ?? input.unitPriceCny * Double(input.quantity),
        itemStatus: input.itemStatus,
        purchaseDate: input.purchaseDate,
        statusDate: nil,
        channel: input.channel,
        notes: input.notes,
        brand: input.brandName.map { NamedRef(id: UUID().uuidString, name: $0) },
        category: category,
        gearItem: GearSummary(
          id: UUID().uuidString,
          catalogEquipmentID: input.catalogEquipmentID,
          modelCode: input.modelCode,
          coverImageUrl: input.gearCoverImageUrl,
          imageKey: input.gearImageKey,
          profileDetails: input.profileDetails
        )
      )
      purchases.insert(created, at: 0)
      analytics = PreviewData.analytics.replacingTotals(from: purchases)
      return true
    }

    isLoading = true
    defer { isLoading = false }
    errorMessage = nil
    do {
      let data = try await repository.createPurchase(input)
      apply(data)
      return true
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }

  @discardableResult
  func purchaseWishlistItem(id: String, purchaseInput: PurchaseInput) async -> Bool {
    if isDemoMode {
      guard wishlistItems.contains(where: { $0.id == id }) else {
        errorMessage = "这条心愿已不存在，无法转为购买记录。"
        return false
      }
      await createPurchase(purchaseInput)
      wishlistItems = wishlistItems.map { item in
        item.id == id ? item.replacingStatus(.purchased) : item
      }
      analytics = PreviewData.analytics.replacingTotals(from: purchases)
      return true
    }

    isLoading = true
    errorMessage = nil
    do {
      let data = try await repository.purchaseWishlistItem(id: id, purchaseInput: purchaseInput)
      apply(data)
      isLoading = false
      return true
    } catch {
      errorMessage = error.localizedDescription
      isLoading = false
      return false
    }
  }

  @discardableResult
  func updateGearItem(id: String, input: GearEditInput) async -> Bool {
    guard !isDemoMode else { return false }
    isLoading = true
    defer { isLoading = false }
    errorMessage = nil
    do {
      let data = try await repository.updateGearItem(id: id, input: input)
      apply(data)
      return true
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }

  func updatePurchaseRecord(id: String, input: PurchaseEditInput) async -> Bool {
    guard !isDemoMode else { return false }
    isLoading = true
    errorMessage = nil
    do {
      let data = try await repository.updatePurchaseRecord(id: id, input: input)
      apply(data)
    } catch {
      errorMessage = error.localizedDescription
    }
    isLoading = false
    return errorMessage == nil
  }

  @discardableResult
  func createWishlistItem(_ input: WishlistEditInput) async -> Bool {
    if isDemoMode {
      wishlistItems.insert(Self.makePreviewWishlistItem(from: input), at: 0)
      analytics = PreviewData.analytics.replacingTotals(from: purchases)
      return true
    }

    isLoading = true
    defer { isLoading = false }
    errorMessage = nil
    do {
      let data = try await repository.createWishlistItem(input)
      apply(data)
      return true
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }

  func activeWishlistItem(matching entry: LocalGearCatalogEntry) -> WishlistItem? {
    LocalGearCatalog.activeWishlistItem(matching: entry, in: wishlistItems)
  }

  func addCatalogEntryToWishlist(_ entry: LocalGearCatalogEntry) async -> CatalogWishlistAddResult {
    guard activeWishlistItem(matching: entry) == nil else {
      return .alreadyExists
    }

    errorMessage = nil
    await createWishlistItem(
      WishlistEditInput(
        name: entry.name,
        targetPriceCny: entry.suggestedUnitPriceCny,
        currentSeenPriceCny: nil,
        priority: 3,
        status: .want,
        sourceUrl: nil,
        imageUrl: nil,
        notes: nil,
        brandName: entry.brandName,
        categoryName: entry.categoryName
      )
    )
    return errorMessage == nil ? .added : .failed
  }

  @discardableResult
  func updateWishlistItem(id: String, input: WishlistEditInput) async -> Bool {
    if isDemoMode {
      wishlistItems = wishlistItems.map { item in
        item.id == id ? Self.makePreviewWishlistItem(from: input, id: id) : item
      }
      analytics = PreviewData.analytics.replacingTotals(from: purchases)
      return true
    }

    isLoading = true
    defer { isLoading = false }
    errorMessage = nil
    do {
      let data = try await repository.updateWishlistItem(id: id, input: input)
      apply(data)
      return true
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }

  @discardableResult
  func deleteWishlistItem(id: String) async -> Bool {
    let removed = wishlistItems.first { $0.id == id }
    if isDemoMode {
      wishlistItems.removeAll { $0.id == id }
      if let removed { undoOperation = .wishlist(removed) }
      analytics = PreviewData.analytics.replacingTotals(from: purchases)
      return true
    }

    isLoading = true
    defer { isLoading = false }
    errorMessage = nil
    do {
      let data = try await repository.deleteWishlistItem(id: id)
      apply(data)
      if let removed { undoOperation = .wishlist(removed) }
      return true
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }

  @discardableResult
  func deleteGearItem(id: String) async -> Bool {
    guard !isDemoMode else { return false }
    isLoading = true
    defer { isLoading = false }
    errorMessage = nil
    do {
      let data = try await repository.deleteGearItem(id: id)
      apply(data)
      return true
    } catch {
      errorMessage = error.localizedDescription
      return false
    }
  }

  private static func makePreviewWishlistItem(from input: WishlistEditInput, id: String = UUID().uuidString) -> WishlistItem {
    WishlistItem(
      id: id,
      name: input.name,
      targetPriceCny: input.targetPriceCny,
      currentSeenPriceCny: input.currentSeenPriceCny,
      priority: input.priority,
      status: input.status,
      sourceUrl: input.sourceUrl,
      imageUrl: input.imageUrl,
      notes: input.notes,
      brand: input.brandName.map { NamedRef(id: UUID().uuidString, name: $0) },
      category: input.categoryName.map { NamedRef(id: UUID().uuidString, name: $0) }
    )
  }
}
