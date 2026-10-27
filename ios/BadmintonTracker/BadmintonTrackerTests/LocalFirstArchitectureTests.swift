import Foundation
import SwiftData
import XCTest
import UIKit
import UniformTypeIdentifiers
@testable import BadmintonTracker

@MainActor
final class LocalFirstArchitectureTests: XCTestCase {
  private var seedBundle: Bundle {
    Bundle(for: LocalFirstArchitectureTests.self)
  }

  func testDeletingOnePurchaseRecalculatesInventoryAndPersists() async throws {
    let container = try BadmintonDataContainer.inMemory()
    let repository = makeIsolatedRepository(container: container)
    let initial = try await repository.createPurchase(PurchaseInput(categoryName: "羽毛球",
      itemNameSnapshot: "删除测试训练球", unitPriceCny: 100, quantity: 4, totalPriceCny: 380,
      purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    let original = try XCTUnwrap(initial.purchases.first)
    let consumption = ConsumptionRecord(quantity: 2, finishedDate: "2026-01-20T00:00:00Z")
    _ = try await repository.updatePurchaseRecord(id: original.id, input: PurchaseEditInput(
      consumptionRecords: [consumption], unitPriceCny: 100, quantity: 4,
      purchaseDate: original.purchaseDate, itemStatus: .inUse))
    let added = try await repository.createPurchase(PurchaseInput(categoryName: "羽毛球",
      itemNameSnapshot: original.itemNameSnapshot, unitPriceCny: 120, quantity: 2,
      purchaseDate: "2026-02-01T00:00:00Z", itemStatus: .stored))
    let removed = try XCTUnwrap(added.purchases.first { $0.id != original.id })

    let deleted = try await repository.deletePurchaseRecord(id: removed.id)
    XCTAssertEqual(deleted.purchases.map(\.id), [original.id])
    XCTAssertEqual(deleted.purchases.first?.consumptionHistory, [consumption])
    XCTAssertEqual(deleted.purchases.first?.remainingQuantity, 2)
    XCTAssertEqual(deleted.gearWallItems.count, 1)
    XCTAssertEqual(deleted.gearWallItems.first?.totalQuantity, 4)
    XCTAssertEqual(deleted.gearWallItems.first?.usedUpQuantity, 2)
    XCTAssertEqual(deleted.gearWallItems.first?.latestPurchaseDate, original.purchaseDate)
    XCTAssertEqual(deleted.analytics.trend.reduce(0) { $0 + $1.amount }, 380)

    let reloaded = try await makeIsolatedRepository(container: container).fetchAppData()
    XCTAssertEqual(reloaded.purchases.map(\.id), [original.id])
    XCTAssertEqual(reloaded.purchases.first?.consumptionHistory, [consumption])
    let restored = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let roundTrip = try await restored.importBackupData(repository.exportBackupData())
    XCTAssertEqual(roundTrip.purchases.map(\.id), [original.id])
    XCTAssertEqual(roundTrip.gearWallItems.first?.totalQuantity, 4)
  }

  func testDeletingLastPurchaseCleansUpOnlyItsEquipmentAndStringing() async throws {
    let container = try BadmintonDataContainer.inMemory()
    let repository = makeIsolatedRepository(container: container)
    let catalogCount = try await repository.fetchCatalogEquipment().count
    let firstString = StringingRecord(stringName: "BG80", stringingDate: "2026-01-02T00:00:00Z", costCny: 60)
    let secondString = StringingRecord(stringName: "BG65", stringingDate: "2026-02-02T00:00:00Z", costCny: 40)
    let first = try await repository.createPurchase(PurchaseInput(categoryName: "球拍",
      profileDetails: .racket(RacketGearDetails(stringHistory: [firstString])),
      itemNameSnapshot: "测试球拍 A", unitPriceCny: 500, quantity: 1,
      purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    let removed = try XCTUnwrap(first.purchases.first)
    let second = try await repository.createPurchase(PurchaseInput(categoryName: "球拍",
      profileDetails: .racket(RacketGearDetails(stringHistory: [secondString])),
      itemNameSnapshot: "测试球拍 B", unitPriceCny: 700, quantity: 1,
      purchaseDate: "2026-02-01T00:00:00Z", itemStatus: .inUse))
    let retained = try XCTUnwrap(second.purchases.first { $0.id != removed.id })
    _ = try await repository.createWishlistItem(WishlistEditInput(name: "另一个心愿", priority: 3, status: .want))

    let deleted = try await repository.deletePurchaseRecord(id: removed.id)
    XCTAssertEqual(deleted.purchases.map(\.id), [retained.id])
    XCTAssertEqual(deleted.gearWallItems.map(\.name), [retained.itemNameSnapshot])
    XCTAssertEqual(deleted.wishlistItems.map(\.name), ["另一个心愿"])
    let context = ModelContext(container)
    XCTAssertEqual(try context.fetch(FetchDescriptor<PurchaseRecordEntity>()).count, 1)
    XCTAssertEqual(try context.fetch(FetchDescriptor<UserEquipmentEntity>()).count, 1)
    XCTAssertEqual(try context.fetch(FetchDescriptor<StringingRecordEntity>()).map(\.id), [secondString.id])
    let remainingCatalog = try await repository.fetchCatalogEquipment()
    XCTAssertEqual(remainingCatalog.count, catalogCount)

    _ = try await repository.deletePurchaseRecord(id: retained.id)
    let empty = try await makeIsolatedRepository(container: container).fetchAppData()
    XCTAssertTrue(empty.purchases.isEmpty)
    XCTAssertTrue(empty.gearWallItems.isEmpty)
    let emptyContext = ModelContext(container)
    XCTAssertTrue(try emptyContext.fetch(FetchDescriptor<UserEquipmentEntity>()).isEmpty)
    XCTAssertTrue(try emptyContext.fetch(FetchDescriptor<StringingRecordEntity>()).isEmpty)
    XCTAssertEqual(empty.wishlistItems.count, 1)
  }

  func testDeletingMissingPurchaseLeavesStoredDataUnchanged() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    _ = try await repository.createPurchase(PurchaseInput(categoryName: "羽毛球",
      itemNameSnapshot: "保留的训练球", unitPriceCny: 100, quantity: 2,
      purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .stored))
    let data = try await repository.fetchAppData()
    do {
      _ = try await repository.deletePurchaseRecord(id: UUID().uuidString)
      XCTFail("Deleting a missing purchase must report failure")
    } catch {
      XCTAssertTrue(error is ConsumptionValidationError)
    }
    let reloaded = try await repository.fetchAppData()
    XCTAssertEqual(reloaded.purchases, data.purchases)
    XCTAssertEqual(reloaded.gearWallItems, data.gearWallItems)
  }

  func testPurchaseDeletionRefreshesSessionAndOffersLatestPurchaseUndo() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let session = AppSession(repository: repository)
    for day in ["01", "02"] {
      let saved = await session.createPurchase(PurchaseInput(categoryName: "羽毛球",
        itemNameSnapshot: "训练球", unitPriceCny: 100, quantity: 2,
        purchaseDate: "2026-01-\(day)T00:00:00Z", itemStatus: .inUse))
      XCTAssertTrue(saved)
    }
    let removed = try XCTUnwrap(session.purchases.first)
    let retained = try XCTUnwrap(session.purchases.last)
    session.undoOperation = .consumption(purchaseID: retained.id, recordID: "other", originalStatus: .stored)
    let firstDeleted = await session.deletePurchaseRecord(id: removed.id)
    XCTAssertTrue(firstDeleted)
    XCTAssertNotNil(session.undoOperation)
    XCTAssertEqual(session.purchases.map(\.id), [retained.id])
    XCTAssertEqual(session.gearWallItems.first?.totalQuantity, 2)
    XCTAssertEqual(session.spendingEntries.reduce(0) { $0 + ($1.amount ?? 0) }, 200)
    let lastDeleted = await session.deletePurchaseRecord(id: retained.id)
    XCTAssertTrue(lastDeleted)
    guard case .purchase(let deletion) = session.undoOperation else { return XCTFail("Expected purchase undo") }
    XCTAssertEqual(deletion.purchase.id, retained.id)
    XCTAssertTrue(session.purchases.isEmpty)
    XCTAssertTrue(session.gearItems.isEmpty)
    XCTAssertTrue(session.gearWallItems.isEmpty)
    XCTAssertTrue(session.spendingEntries.isEmpty)
    XCTAssertFalse(session.isLoading)
  }

  func testExistingBrandSurvivesCustomModelsInCategoriesWithoutCatalogEntries() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let entries = try await repository.fetchCatalogEquipment().map(LocalGearCatalogEntry.init)
    XCTAssertTrue(entries.contains { $0.brandName == "RSL" && $0.categoryName == "羽毛球" })
    XCTAssertFalse(entries.contains { $0.brandName == "RSL" && $0.categoryName == "球拍" })
    let customModel = "CUSTOM-RACKET-2026"
    for category in ["羽毛球", "球拍", "球鞋", "其他"] {
      let selection = PurchaseCatalogSelection(brandName: "亚狮龙", modelCode: customModel,
        categoryName: category, entries: entries)
      XCTAssertEqual(selection.brandName, "RSL")
      XCTAssertEqual(selection.brandChoice, "RSL", "Brand selection must not depend on catalog models in this category")
      XCTAssertEqual(selection.modelChoice, PurchaseInputChoice.custom)
    }
    let selection = PurchaseCatalogSelection(brandName: "RSL", modelCode: customModel,
      categoryName: "球拍", entries: entries)
    let created = try await repository.createPurchase(PurchaseInput(brandName: selection.brandName,
      modelCode: customModel, categoryName: "球拍", itemNameSnapshot: "目录外球拍",
      unitPriceCny: 600, quantity: 1, purchaseDate: "2026-10-26T00:00:00Z", itemStatus: .inUse))
    XCTAssertEqual(created.purchases.first?.brand?.name, "RSL")
    let reloaded = try await repository.fetchAppData()
    XCTAssertEqual(reloaded.purchases.first?.brand?.name, "RSL")
    XCTAssertEqual(reloaded.purchases.first?.gearItem?.modelCode, customModel)
    XCTAssertNil(reloaded.purchases.first?.gearItem?.catalogEquipmentID)
    XCTAssertEqual(reloaded.gearWallItems.first?.category?.name, "球拍")
  }

  func testRestoredCatalogModelMustMatchBothBrandAndCategory() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let entries = try await repository.fetchCatalogEquipment().map(LocalGearCatalogEntry.init)
    let entry = try XCTUnwrap(entries.first { $0.brandName == "YONEX" && $0.categoryName == "球拍" && $0.modelCode != nil })
    let model = try XCTUnwrap(entry.modelCode)
    let matched = PurchaseCatalogSelection(brandName: "尤尼克斯", modelCode: " \(model.lowercased()) ",
      categoryName: "球拍", entries: entries)
    XCTAssertEqual(matched.brandChoice, "YONEX")
    XCTAssertEqual(matched.modelChoice, entry.id)
    for (brand, category) in [("RSL", "球拍"), ("YONEX", "球鞋")] {
      let other = PurchaseCatalogSelection(brandName: brand, modelCode: model, categoryName: category, entries: entries)
      XCTAssertEqual(other.brandChoice, brand)
      XCTAssertEqual(other.modelChoice, PurchaseInputChoice.custom)
    }
  }

  func testRestoringUnknownBrandKeepsItsNameAndCustomModel() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let entries = try await repository.fetchCatalogEquipment().map(LocalGearCatalogEntry.init)
    let selection = PurchaseCatalogSelection(brandName: "  私人球馆品牌  ", modelCode: "新型号",
      categoryName: "羽毛球", entries: entries)
    XCTAssertEqual(selection.brandName, "私人球馆品牌")
    XCTAssertEqual(selection.brandChoice, PurchaseInputChoice.custom)
    XCTAssertEqual(selection.modelChoice, PurchaseInputChoice.custom)
  }

  func testRepeatPurchaseStartsFreshAndPreservesEquipmentAndPreviousPrice() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let history = StringingRecord(stringName: "BG80", stringingDate: "2026-01-01T00:00:00Z", costCny: 60)
    let created = try await repository.createPurchase(PurchaseInput(brandName: "测试品牌", modelCode: "R1", categoryName: "球拍",
      profileDetails: .racket(RacketGearDetails(weightSpec: "4U", gripSpec: "G5", stringHistory: [history])),
      itemNameSnapshot: "常用球拍", unitPriceCny: 888, quantity: 3,
      purchaseDate: "2026-01-01T00:00:00Z", channel: "线下门店", itemStatus: .wornOut, notes: "上一次的备注"))
    let purchase = try XCTUnwrap(created.purchases.first)
    let today = Date(timeIntervalSince1970: 1_800_000_000)
    let repeatInput = purchase.repeatPurchaseInput(on: today)
    XCTAssertEqual(repeatInput.brandName, purchase.brand?.name)
    XCTAssertEqual(repeatInput.modelCode, purchase.gearItem?.modelCode)
    XCTAssertEqual(repeatInput.gearImageKey, purchase.gearItem?.imageKey)
    XCTAssertEqual(repeatInput.profileDetails, purchase.gearItem?.profileDetails)
    XCTAssertEqual(repeatInput.unitPriceCny, 888)
    XCTAssertEqual(repeatInput.channel, purchase.channel)
    XCTAssertEqual(repeatInput.quantity, 1)
    XCTAssertEqual(repeatInput.totalPriceCny, 888)
    XCTAssertEqual(repeatInput.itemStatus, .inUse)
    XCTAssertEqual(repeatInput.purchaseDate, ISO8601DateFormatter().string(from: today))
    XCTAssertNil(repeatInput.notes)
    let repeated = try await repository.createPurchase(repeatInput)
    XCTAssertEqual(repeated.gearWallItems.count, 1)
    XCTAssertEqual(repeated.gearWallItems.first?.profileDetails, purchase.gearItem?.profileDetails)
    XCTAssertEqual(repeated.purchases.first?.consumptionHistory, [])
  }

  func testLowStockIncludesStoredTubesAndExcludesConsumedAndRetiredStock() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    var data = try await repository.createPurchase(PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "训练球",
      unitPriceCny: 100, quantity: 2, purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    let purchase = try XCTUnwrap(data.purchases.first)
    XCTAssertFalse(try XCTUnwrap(data.gearWallItems.first).isLowOnShuttles)
    data = try await repository.updatePurchaseRecord(id: purchase.id, input: PurchaseEditInput(
      consumptionRecords: [ConsumptionRecord(quantity: 1, finishedDate: "2026-01-02T00:00:00Z")],
      unitPriceCny: 100, quantity: 2, purchaseDate: purchase.purchaseDate, itemStatus: .inUse))
    XCTAssertTrue(try XCTUnwrap(data.gearWallItems.first).isLowOnShuttles)
    data = try await repository.createPurchase(PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "训练球",
      unitPriceCny: 100, quantity: 1, purchaseDate: "2026-02-01T00:00:00Z", itemStatus: .stored))
    XCTAssertEqual(data.gearWallItems.first?.stockQuantity, 2)
    XCTAssertFalse(try XCTUnwrap(data.gearWallItems.first).isLowOnShuttles)
    let stored = try XCTUnwrap(data.purchases.first { $0.itemStatus == .stored })
    data = try await repository.updatePurchaseRecord(id: stored.id, input: PurchaseEditInput(
      unitPriceCny: 100, quantity: 1, purchaseDate: stored.purchaseDate, itemStatus: .wornOut))
    XCTAssertTrue(try XCTUnwrap(data.gearWallItems.first).isLowOnShuttles)
    data = try await repository.createPurchase(PurchaseInput(categoryName: "球拍", itemNameSnapshot: "球拍",
      unitPriceCny: 100, quantity: 1, purchaseDate: "2026-03-01T00:00:00Z", itemStatus: .inUse))
    XCTAssertFalse(try XCTUnwrap(data.gearWallItems.first { $0.category?.name == "球拍" }).isLowOnShuttles)
  }

  func testPurchaseUndoRestoresMediaStringingAndKeepsNewRecords() async throws {
    let container = try BadmintonDataContainer.inMemory()
    let repository = makeIsolatedRepository(container: container)
    let storage = LocalMediaStorage()
    let mediaID = UUID()
    let folder = try storage.makeAssetDirectory(id: mediaID)
    defer { try? storage.removeAsset(id: mediaID) }
    let bytes = Data([1, 2, 3, 4])
    for name in ["original.jpg", "processed.png", "thumbnail.jpg"] { try bytes.write(to: folder.appending(path: name)) }
    let reference = storage.reference(forRelativePath: mediaID.uuidString.lowercased() + "/processed.png")
    let string = StringingRecord(stringName: "BG80", stringingDate: "2026-01-01T00:00:00Z", costCny: 60)
    let original = try await repository.createPurchase(PurchaseInput(categoryName: "球拍", gearCoverImageUrl: reference,
      profileDetails: .racket(RacketGearDetails(weightSpec: "4U", stringHistory: [string])),
      itemNameSnapshot: "撤销测试球拍", unitPriceCny: 600, quantity: 1,
      purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    XCTAssertEqual(original.purchases.count, 1)
    let beforeDeletion = try await repository.fetchAppData()
    let purchase = try XCTUnwrap(beforeDeletion.purchases.first)
    let result = try await repository.deletePurchaseWithUndo(id: purchase.id)
    XCTAssertTrue(result.data.purchases.isEmpty)
    XCTAssertFalse(FileManager.default.fileExists(atPath: folder.path))
    _ = try await repository.createPurchase(PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "期间新买的球",
      unitPriceCny: 100, quantity: 2, purchaseDate: "2026-02-01T00:00:00Z", itemStatus: .stored))
    _ = try await repository.createWishlistItem(WishlistEditInput(name: "新心愿", priority: 3, status: .want))
    let restored = try await repository.restorePurchase(result.deletion)
    XCTAssertEqual(restored.purchases.count, 2)
    XCTAssertEqual(restored.wishlistItems.map(\.name), ["新心愿"])
    XCTAssertEqual(restored.gearWallItems.first { $0.name == purchase.itemNameSnapshot }?.profileDetails, purchase.gearItem?.profileDetails)
    XCTAssertEqual(restored.analytics.trend.reduce(0) { $0 + $1.amount }, 800)
    for name in ["original.jpg", "processed.png", "thumbnail.jpg"] {
      XCTAssertEqual(try Data(contentsOf: folder.appending(path: name)), bytes)
    }
    let context = ModelContext(container)
    XCTAssertEqual(try context.fetch(FetchDescriptor<StringingRecordEntity>()).map(\.id), [string.id])
    let repeated = try await repository.restorePurchase(result.deletion)
    XCTAssertEqual(repeated.purchases.count, 2)
    let reloaded = try await makeIsolatedRepository(container: container).fetchAppData()
    XCTAssertEqual(Set(reloaded.purchases.map(\.id)), Set(restored.purchases.map(\.id)))
  }

  func testPurchaseUndoPreservesEquipmentEditsMadeAfterDeletion() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let original = try await repository.createPurchase(PurchaseInput(categoryName: "羽毛球",
      profileDetails: .shuttle(ShuttleGearDetails(ballsPerTube: 12, speed: "76")),
      itemNameSnapshot: "训练球", unitPriceCny: 100, quantity: 2,
      purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    let purchase = try XCTUnwrap(original.purchases.first)
    _ = try await repository.createPurchase(purchase.repeatPurchaseInput())
    let deletion = try await repository.deletePurchaseWithUndo(id: purchase.id)
    let gear = try XCTUnwrap(deletion.data.gearWallItems.first)
    _ = try await repository.updateGearItem(id: gear.id, input: GearEditInput(name: "改名后的训练球",
      categoryName: "羽毛球", profileDetails: .shuttle(ShuttleGearDetails(ballsPerTube: 12, speed: "77"))))
    let restored = try await repository.restorePurchase(deletion.deletion)
    XCTAssertEqual(restored.purchases.count, 2)
    XCTAssertEqual(restored.gearWallItems.first?.profileDetails, .shuttle(ShuttleGearDetails(ballsPerTube: 12, speed: "77")))
    XCTAssertEqual(restored.gearWallItems.count, 1)
    XCTAssertEqual(restored.gearWallItems.first?.name, "改名后的训练球")
    XCTAssertEqual(restored.gearWallItems.first?.stockQuantity, 3)
  }

  func testUndoRestoresPartialConsumptionAndSpending() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let original = try await repository.createPurchase(PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "训练球",
      unitPriceCny: 100, quantity: 4, totalPriceCny: 380,
      purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    let purchase = try XCTUnwrap(original.purchases.first)
    let usage = ConsumptionRecord(quantity: 2, finishedDate: "2026-01-20T00:00:00Z")
    _ = try await repository.updatePurchaseRecord(id: purchase.id, input: PurchaseEditInput(
      consumptionRecords: [usage], unitPriceCny: 95, quantity: 4,
      purchaseDate: purchase.purchaseDate, itemStatus: .inUse))
    let deleted = try await repository.deletePurchaseWithUndo(id: purchase.id)
    let restored = try await repository.restorePurchase(deleted.deletion)
    XCTAssertEqual(restored.purchases.first?.consumptionHistory, [usage])
    XCTAssertEqual(restored.purchases.first?.remainingQuantity, 2)
    XCTAssertEqual(restored.gearWallItems.first?.usedUpQuantity, 2)
    XCTAssertEqual(restored.gearWallItems.first?.stockQuantity, 2)
    XCTAssertEqual(restored.analytics.trend.reduce(0) { $0 + $1.amount }, 380)
  }

  func testPurchaseUndoWindowExpiresWithoutRestoringDeletedData() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let session = AppSession(repository: repository, purchaseUndoDuration: .milliseconds(40))
    _ = await session.createPurchase(PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "测试球",
      unitPriceCny: 100, quantity: 1, purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    let purchase = try XCTUnwrap(session.purchases.first)
    let deleted = await session.deletePurchaseRecord(id: purchase.id)
    XCTAssertTrue(deleted)
    XCTAssertNotNil(session.undoOperation)
    try await Task.sleep(for: .milliseconds(150))
    XCTAssertNil(session.undoOperation)
    XCTAssertTrue(session.purchases.isEmpty)
    let undone = await session.undoLastOperation()
    XCTAssertFalse(undone)
  }

  func testPurchaseUndoExpiryDoesNotClearANewerOperation() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let session = AppSession(repository: repository, purchaseUndoDuration: .milliseconds(40))
    _ = await session.createPurchase(PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "测试球",
      unitPriceCny: 100, quantity: 1, purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    let purchase = try XCTUnwrap(session.purchases.first)
    _ = await session.deletePurchaseRecord(id: purchase.id)
    session.undoOperation = .consumption(purchaseID: "new", recordID: "new", originalStatus: .inUse)
    try await Task.sleep(for: .milliseconds(150))
    guard case .consumption = session.undoOperation else { return XCTFail("New undo must remain available") }
  }

  func testCatalogSeedImportsOnce() throws {
    let container = try BadmintonDataContainer.inMemory()
    let context = ModelContext(container)
    let service = CatalogSeedService(context: context, bundle: seedBundle)

    XCTAssertTrue(try service.importBundledSeedIfNeeded())
    let firstCount = try context.fetch(FetchDescriptor<CatalogEquipmentEntity>()).count
    XCTAssertGreaterThan(firstCount, 0)

    XCTAssertFalse(try service.importBundledSeedIfNeeded())
    XCTAssertEqual(try context.fetch(FetchDescriptor<CatalogEquipmentEntity>()).count, firstCount)
  }

  func testBundledCatalogContains88DProAndItsImage() throws {
    let container = try BadmintonDataContainer.inMemory()
    let context = ModelContext(container)
    let seed = try CatalogSeedService(context: context, bundle: seedBundle).bundledSeed()
    let equipment = try XCTUnwrap(seed.equipment.first(where: { $0.model == "AX88D PRO" }))

    XCTAssertGreaterThanOrEqual(seed.version, 2)
    XCTAssertEqual(equipment.id, UUID(uuidString: "30c91339-c606-5c33-884f-53a3e877a890"))
    XCTAssertEqual(equipment.imageKey, "yonex_racket_astrox88dpro_main_01")
    XCTAssertNotNil(Bundle.main.url(
      forResource: "yonex_racket_astrox88dpro_main_01.png",
      withExtension: nil,
      subdirectory: "GearImages"
    ))
  }

  func testLegacyStringingIDDecodesAsStableUUID() throws {
    let data = Data(#"{"id":"legacy-string-id","stringName":"YONEX BG80"}"#.utf8)
    let record = try JSONDecoder().decode(StringingRecord.self, from: data)
    XCTAssertEqual(record.id, StableUUID.from("legacy-string-id"))
  }

  func testSeedUpdateAddsAndRetiresWithoutTouchingUserEquipment() throws {
    let container = try BadmintonDataContainer.inMemory()
    let context = ModelContext(container)
    let service = CatalogSeedService(context: context, bundle: seedBundle)
    let original = try service.bundledSeed()
    try service.apply(original)
    let linkedCatalog = try XCTUnwrap(original.equipment.first)
    let userID = UUID()
    context.insert(UserEquipmentEntity(
      id: userID,
      catalogEquipmentID: linkedCatalog.id,
      legacyIdentity: nil,
      customName: linkedCatalog.name,
      customBrand: linkedCatalog.brand,
      customModel: linkedCatalog.model,
      customVariant: nil,
      category: linkedCatalog.category,
      notes: "个人备注",
      coverImageReference: nil,
      imageKey: linkedCatalog.imageKey,
      createdAt: Date(),
      updatedAt: Date()
    ))
    try context.save()

    var added = linkedCatalog
    added = CatalogEquipment(
      id: UUID(),
      name: "新增测试装备",
      brand: "TEST",
      model: "V2",
      series: nil,
      category: .racket,
      variant: nil,
      weightClass: nil,
      gripSize: nil,
      color: nil,
      releaseYear: nil,
      suggestedUnitPriceCny: nil,
      imageKey: nil,
      popularity: 1,
      tags: [],
      revision: 2,
      isActive: true,
      createdAt: Date(),
      updatedAt: Date()
    )
    let update = CatalogSeedFile(
      version: original.version + 1,
      equipment: Array(original.equipment.dropFirst()) + [added]
    )
    try service.apply(update)

    let catalog = try context.fetch(FetchDescriptor<CatalogEquipmentEntity>())
    XCTAssertEqual(catalog.first(where: { $0.id == linkedCatalog.id })?.isActive, false)
    XCTAssertNotNil(catalog.first(where: { $0.id == added.id }))
    let user = try context.fetch(FetchDescriptor<UserEquipmentEntity>()).first(where: { $0.id == userID })
    XCTAssertEqual(user?.catalogEquipmentID, linkedCatalog.id)
    XCTAssertEqual(user?.notes, "个人备注")
  }

  func testRepositorySupportsCatalogAndCustomUserEquipment() async throws {
    let container = try BadmintonDataContainer.inMemory()
    let repository = makeIsolatedRepository(container: container)
    let catalog = try await repository.fetchCatalogEquipment()
    let firstCatalog = try XCTUnwrap(catalog.first)
    let now = Date()
    let linked = UserEquipment(
      id: UUID(),
      catalogEquipmentID: firstCatalog.id,
      customName: firstCatalog.name,
      customBrand: firstCatalog.brand,
      customModel: firstCatalog.model,
      customVariant: nil,
      category: firstCatalog.category,
      notes: "来自公共库",
      profileDetails: nil,
      createdAt: now,
      updatedAt: now
    )
    let custom = UserEquipment(
      id: UUID(),
      catalogEquipmentID: nil,
      customName: "我的自定义球拍",
      customBrand: "自定义品牌",
      customModel: "Prototype",
      customVariant: "4UG5",
      category: .racket,
      notes: "不依赖公共库",
      profileDetails: .racket(RacketGearDetails(
        weightSpec: "4U",
        gripSpec: "G5",
        stringHistory: [StringingRecord(
          id: StableUUID.from("legacy-string-id"),
          stringName: "YONEX BG80",
          mainTension: 28,
          crossTension: 26,
          stringingDate: "2026-08-14T00:00:00Z",
          notes: nil
        )]
      )),
      createdAt: now,
      updatedAt: now
    )

    try await repository.createUserEquipment(linked)
    try await repository.createUserEquipment(custom)
    let users = try await repository.fetchUserEquipment()
    XCTAssertEqual(users.count, 2)
    XCTAssertEqual(users.first(where: { $0.id == linked.id })?.catalogEquipmentID, firstCatalog.id)
    XCTAssertNil(users.first(where: { $0.id == custom.id })?.catalogEquipmentID)

    let context = ModelContext(container)
    let records = try context.fetch(FetchDescriptor<StringingRecordEntity>())
    XCTAssertEqual(records.count, 1)
    XCTAssertEqual(records.first?.id, StableUUID.from("legacy-string-id"))

    var updatedCustom = custom
    updatedCustom.notes = "更新后的个人备注"
    updatedCustom.updatedAt = now.addingTimeInterval(60)
    try await repository.updateUserEquipment(updatedCustom)
    let updatedUsers = try await repository.fetchUserEquipment()
    XCTAssertEqual(
      updatedUsers.first(where: { $0.id == custom.id })?.notes,
      "更新后的个人备注"
    )

    try await repository.deleteUserEquipment(id: linked.id)
    let remainingUsers = try await repository.fetchUserEquipment()
    XCTAssertEqual(remainingUsers.map(\.id), [custom.id])
  }

  func testCatalogPurchaseAndCustomPurchaseRemainIndependent() async throws {
    let container = try BadmintonDataContainer.inMemory()
    let repository = makeIsolatedRepository(container: container)
    let catalogItems = try await repository.fetchCatalogEquipment()
    let catalog = try XCTUnwrap(catalogItems.first)
    let date = "2026-08-14T00:00:00Z"

    _ = try await repository.createPurchase(PurchaseInput(
      catalogEquipmentID: catalog.id,
      brandName: catalog.brand,
      modelCode: catalog.model,
      categoryId: catalog.category.rawValue,
      categoryName: catalog.category.rawValue,
      gearCoverImageUrl: nil,
      gearImageKey: catalog.imageKey,
      itemNameSnapshot: catalog.name,
      unitPriceCny: 100,
      quantity: 1,
      totalPriceCny: 100,
      purchaseDate: date,
      channel: nil,
      itemStatus: .inUse,
      notes: "购买备注"
    ))
    let data = try await repository.createPurchase(PurchaseInput(
      brandName: "自定义品牌",
      modelCode: "CUSTOM-1",
      categoryId: EquipmentCategory.racket.rawValue,
      categoryName: EquipmentCategory.racket.rawValue,
      gearCoverImageUrl: nil,
      itemNameSnapshot: "公共库不存在的装备",
      unitPriceCny: 200,
      quantity: 1,
      totalPriceCny: 200,
      purchaseDate: date,
      channel: nil,
      itemStatus: .inUse,
      notes: "自定义备注"
    ))

    XCTAssertEqual(data.gearWallItems.count, 2)
    let users = try await repository.fetchUserEquipment()
    XCTAssertEqual(users.count, 2)
    XCTAssertNotNil(users.first(where: { $0.catalogEquipmentID == catalog.id }))
    XCTAssertNotNil(users.first(where: { $0.catalogEquipmentID == nil }))
  }

  func testPartialConsumptionPersistsAndRestoresWithoutChangingSpend() async throws {
    let container = try BadmintonDataContainer.inMemory()
    let repository = makeIsolatedRepository(container: container)
    let data = try await repository.createPurchase(PurchaseInput(
      categoryName: "羽毛球", itemNameSnapshot: "消耗测试用球", unitPriceCny: 100,
      quantity: 4, totalPriceCny: 380, purchaseDate: "2026-01-01T00:00:00Z",
      itemStatus: .inUse
    ))
    let purchase = try XCTUnwrap(data.purchases.first)
    let event = ConsumptionRecord(quantity: 2, finishedDate: "2026-01-20T00:00:00Z",
      startedDate: "2026-01-10T00:00:00Z")
    var edit = PurchaseEditInput(consumptionRecords: [event], unitPriceCny: 100, quantity: 4,
      purchaseDate: purchase.purchaseDate, itemStatus: .inUse)
    let partial = try await repository.updatePurchaseRecord(id: purchase.id, input: edit)
    XCTAssertEqual(partial.purchases.first?.quantity, 4)
    XCTAssertEqual(partial.purchases.first?.remainingQuantity, 2)
    XCTAssertEqual(partial.purchases.first?.totalPriceCny, purchase.totalPriceCny)
    XCTAssertEqual(partial.gearWallItems.first?.activeQuantity, 2)
    XCTAssertEqual(partial.gearWallItems.first?.usedUpQuantity, 2)
    XCTAssertEqual(event.usageDays, 10)

    let reloaded = try await makeIsolatedRepository(container: container).fetchAppData()
    XCTAssertEqual(reloaded.purchases.first?.consumptionRecords, [event])
    let backup = try repository.exportBackupData()
    let restoredRepository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let restored = try await restoredRepository.importBackupData(backup)
    XCTAssertEqual(restored.purchases.first?.consumptionRecords, [event])
    XCTAssertEqual(restored.gearWallItems.first?.activeQuantity, 2)

    edit.consumptionRecords?.append(ConsumptionRecord(quantity: 2, finishedDate: "2026-02-01T00:00:00Z"))
    let completed = try await repository.updatePurchaseRecord(id: purchase.id, input: edit)
    XCTAssertEqual(completed.gearWallItems.first?.activeQuantity, 0)
    XCTAssertEqual(completed.gearWallItems.first?.usedUpQuantity, 4)
    XCTAssertEqual(completed.purchases.first?.inventoryStatusText, "已用完")

    edit.consumptionRecords = [event]
    let undone = try await repository.updatePurchaseRecord(id: purchase.id, input: edit)
    XCTAssertEqual(undone.gearWallItems.first?.activeQuantity, 2)
    XCTAssertEqual(undone.purchases.first?.totalPriceCny, purchase.totalPriceCny)

    // Regression: undo the last event, save, then add a replacement event.
    // Neither an empty history nor a later addition may restore the removed event.
    edit.consumptionRecords = []
    _ = try await repository.updatePurchaseRecord(id: purchase.id, input: edit)
    let afterUndo = try await makeIsolatedRepository(container: container).fetchAppData()
    XCTAssertEqual(afterUndo.purchases.first?.consumptionHistory, [])
    XCTAssertEqual(afterUndo.gearWallItems.first?.activeQuantity, 4)
    let replacement = ConsumptionRecord(quantity: 2, finishedDate: "2026-02-02T00:00:00Z")
    edit.consumptionRecords = [replacement]
    _ = try await repository.updatePurchaseRecord(id: purchase.id, input: edit)
    let afterAdding = try await makeIsolatedRepository(container: container).fetchAppData()
    XCTAssertEqual(afterAdding.purchases.first?.consumptionHistory, [replacement])
    XCTAssertEqual(afterAdding.gearWallItems.first?.activeQuantity, 2)
    XCTAssertEqual(afterAdding.purchases.first?.totalPriceCny, purchase.totalPriceCny)

    edit.quantity = 1
    do {
      _ = try await repository.updatePurchaseRecord(id: purchase.id, input: edit)
      XCTFail("Must reject a purchase quantity below consumed quantity")
    } catch is ConsumptionValidationError { }
    let unchanged = try await repository.fetchAppData()
    XCTAssertEqual(unchanged.purchases.first?.quantity, 4)

    edit.quantity = 4
    edit.consumptionRecords = [ConsumptionRecord(quantity: 1, finishedDate: "2025-12-01T00:00:00Z")]
    do {
      _ = try await repository.updatePurchaseRecord(id: purchase.id, input: edit)
      XCTFail("Must reject consumption before purchase")
    } catch is ConsumptionValidationError { }
  }

  func testLegacyConsumptionDecodingPreservesUnknownDates() throws {
    let raw = Data(#"{"id":"old","itemNameSnapshot":"球","unitPriceCny":100,"quantity":4,"totalPriceCny":400,"itemStatus":"USED_UP","purchaseDate":"2026-01-01T00:00:00Z"}"#.utf8)
    let purchase = try JSONDecoder().decode(PurchaseRecord.self, from: raw)
    XCTAssertEqual(purchase.consumedQuantity, 4)
    XCTAssertEqual(purchase.remainingQuantity, 0)
    XCTAssertNil(purchase.consumptionHistory.first?.finishedDate)
    XCTAssertNil(purchase.consumptionHistory.first?.usageDays)
    let roundTrip = try JSONDecoder().decode(PurchaseRecord.self, from: JSONEncoder().encode(purchase))
    XCTAssertEqual(roundTrip.consumptionHistory, purchase.consumptionHistory)
    let edit = PurchaseEditInput(consumptionRecords: purchase.consumptionHistory,
      unitPriceCny: 100, quantity: 4, purchaseDate: purchase.purchaseDate, itemStatus: .inUse)
    XCTAssertNoThrow(try edit.validateConsumption(existing: purchase))
  }

  func testFailedSubmissionsReturnFailureAndKeepCurrentData() async throws {
    let session = AppSession(repository: FailingSubmissionRepository())
    session.purchases = PreviewData.purchases
    let originalIDs = session.purchases.map(\.id)
    let purchase = PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "测试", unitPriceCny: 100,
      quantity: 1, purchaseDate: "2026-10-08T00:00:00Z", itemStatus: .inUse)
    let created = await session.createPurchase(purchase)
    XCTAssertFalse(created)
    XCTAssertEqual(session.purchases.map(\.id), originalIDs)
    XCTAssertFalse(session.isLoading)
    XCTAssertNotNil(session.errorMessage)
    session.undoOperation = .consumption(purchaseID: originalIDs[0], recordID: "record", originalStatus: .inUse)
    let purchaseDeleted = await session.deletePurchaseRecord(id: originalIDs[0])
    XCTAssertFalse(purchaseDeleted)
    XCTAssertEqual(session.purchases.map(\.id), originalIDs)
    XCTAssertNotNil(session.undoOperation)
    XCTAssertNotNil(session.errorMessage)
    XCTAssertFalse(session.isLoading)
    let gearSaved = await session.updateGearItem(id: "missing", input: GearEditInput(
      name: "测试", brandName: nil, modelCode: nil, categoryName: "羽毛球", gearCoverImageUrl: nil, profileDetails: nil))
    XCTAssertFalse(gearSaved)
    let wishlist = WishlistEditInput(name: "心愿", targetPriceCny: nil, currentSeenPriceCny: nil,
      priority: 3, status: .want, sourceUrl: nil, imageUrl: nil, notes: nil, brandName: nil, categoryName: nil)
    let wishCreated = await session.createWishlistItem(wishlist)
    let wishSaved = await session.updateWishlistItem(id: "missing", input: wishlist)
    XCTAssertFalse(wishCreated)
    XCTAssertFalse(wishSaved)
  }

  func testBackupFileTypeIsExportedAndRecognizedByItsExtension() throws {
    let identifier = "com.tian.badminton-tracker.backup"
    let declarations = try XCTUnwrap(Bundle.main.object(forInfoDictionaryKey: "UTExportedTypeDeclarations") as? [[String: Any]])
    XCTAssertTrue(declarations.contains { $0["UTTypeIdentifier"] as? String == identifier })

    let type = UTType(exportedAs: identifier, conformingTo: .data)
    XCTAssertTrue(type.isDeclared)
    XCTAssertTrue(type.conforms(to: .data))
    XCTAssertEqual(type.preferredFilenameExtension, "btbackup")
    XCTAssertEqual(UTType(filenameExtension: "btbackup"), type)
  }

  func testBackupRoundTripPreservesAllPhotoFilesProfilesWishlistAndLayout() async throws {
    let storage = LocalMediaStorage()
    let mediaID = UUID()
    let folder = try storage.makeAssetDirectory(id: mediaID)
    var restoredIDs: Set<UUID> = []
    defer {
      try? storage.removeAsset(id: mediaID)
      for id in restoredIDs { try? storage.removeAsset(id: id) }
    }
    let image = UIGraphicsImageRenderer(size: CGSize(width: 30, height: 60)).image { context in
      UIColor.systemGreen.setFill()
      context.fill(CGRect(x: 0, y: 0, width: 30, height: 60))
    }
    let photoFiles = ["original.jpg": try XCTUnwrap(image.jpegData(compressionQuality: 0.94)),
      "processed.png": try XCTUnwrap(image.pngData()),
      "thumbnail.jpg": try XCTUnwrap(image.jpegData(compressionQuality: 0.6))]
    for (name, data) in photoFiles { try data.write(to: folder.appending(path: name)) }
    let reference = GearPhotoProcessor.localPhotoReference(for: folder.appending(path: "processed.png"))
    let container = try BadmintonDataContainer.inMemory()
    let source = makeIsolatedRepository(container: container)
    let profile = GearProfileDetails.racket(RacketGearDetails(weightSpec: "4U", gripSpec: "G5",
      stringHistory: [StringingRecord(stringName: "BG80", stringingDate: "2026-02-01T00:00:00Z", costCny: 60)]))
    let created = try await source.createPurchase(PurchaseInput(brandName: "备份品牌", modelCode: "MODEL-1",
      categoryName: "球拍", gearCoverImageUrl: reference, profileDetails: profile,
      itemNameSnapshot: "带照片的球拍", unitPriceCny: 1200, quantity: 1,
      purchaseDate: "2026-01-01T00:00:00Z", channel: "门店", itemStatus: .inUse, notes: "保留备注"))
    _ = try await source.createWishlistItem(WishlistEditInput(name: "有照片的心愿", targetPriceCny: 900,
      currentSeenPriceCny: 1000, priority: 4, status: .want, imageUrl: reference, notes: "心愿备注"))
    let layout = PegboardLayoutStore(active: PegboardLayoutSnapshot(v: 1, height: 900,
      slots: [created.gearWallItems[0].id: PegboardLayoutSlot(x: 0.4, y: 0.3, scale: 1.2, rotate: 15, z: 2)]))
    let context = ModelContext(container)
    let layoutEntity = try XCTUnwrap(context.fetch(FetchDescriptor<PegboardLayoutEntity>()).first)
    layoutEntity.valueData = try JSONEncoder().encode(layout)
    try context.save()
    let original = try await source.fetchAppData()
    let singleFile = try source.exportBackupPackageData()
    let directory = try source.exportBackupPackage()
    XCTAssertEqual(try LocalDataStore.prepareBackup(data: singleFile).photoCount, 3)
    XCTAssertEqual(try LocalDataStore.prepareBackup(package: directory).photoCount, 3)
    // The source files must not be needed on a new device.
    try storage.removeAsset(id: mediaID)

    for backup in [try LocalDataStore.prepareBackup(data: singleFile), try LocalDataStore.prepareBackup(package: directory)] {
      let destination = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
      _ = try await destination.createPurchase(PurchaseInput(categoryName: "其他", itemNameSnapshot: "应被替换",
        unitPriceCny: 1, quantity: 1, purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .stored))
      let restored = try await destination.importBackupPackageData(backup.data)
      let restoredReference = try XCTUnwrap(restored.purchases.first?.gearItem?.coverImageUrl)
      let restoredMedia = try XCTUnwrap(GearPhotoProcessor.mediaFiles(for: restoredReference))
      restoredIDs.insert(restoredMedia.id)
      XCTAssertNotEqual(restoredMedia.id, mediaID)
      XCTAssertEqual(restored.purchases.map(\.id), original.purchases.map(\.id))
      XCTAssertEqual(restored.purchases.first?.notes, "保留备注")
      XCTAssertEqual(restored.purchases.first?.channel, "门店")
      XCTAssertEqual(restored.purchases.first?.gearItem?.profileDetails, original.purchases.first?.gearItem?.profileDetails)
      XCTAssertEqual(restored.wishlistItems.map(\.id), original.wishlistItems.map(\.id))
      XCTAssertEqual(restored.wishlistItems.first?.imageUrl, restoredReference)
      XCTAssertEqual(restored.wishlistItems.first?.priceRecordedAt, original.wishlistItems.first?.priceRecordedAt)
      XCTAssertEqual(restored.pegboardLayouts, layout)
      XCTAssertEqual(restored.analytics, original.analytics)
      XCTAssertNotNil(GearPhotoProcessor.originalImage(for: restoredReference))
      XCTAssertNotNil(GearPhotoProcessor.processedImage(for: restoredReference))
      let archived = try GearPhotoProcessor.archiveMedia(for: restoredReference)
      XCTAssertEqual(archived.count, 3)
      for (path, data) in archived { XCTAssertEqual(data, photoFiles[URL(fileURLWithPath: path).lastPathComponent]) }
      XCTAssertEqual(try LocalDataStore.prepareBackup(data: destination.exportBackupPackageData()).photoCount, 3)
    }
  }

  func testBackupRejectsMissingReferencedPhotoBeforeReplacingRecords() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    _ = try await repository.createPurchase(PurchaseInput(categoryName: "其他", itemNameSnapshot: "保留记录",
      unitPriceCny: 10, quantity: 1, purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .stored))
    let original = try await repository.fetchAppData()
    var json = try XCTUnwrap(JSONSerialization.jsonObject(with: repository.exportBackupPackageData()) as? [String: Any])
    var snapshot = try XCTUnwrap(json["data"] as? [String: Any])
    var purchases = try XCTUnwrap(snapshot["purchases"] as? [[String: Any]])
    var gear = try XCTUnwrap(purchases[0]["gearItem"] as? [String: Any])
    gear["coverImageUrl"] = "badminton-media:///\(UUID().uuidString.lowercased())/processed.png"
    purchases[0]["gearItem"] = gear
    snapshot["purchases"] = purchases
    json["data"] = snapshot
    let invalid = try JSONSerialization.data(withJSONObject: json)
    XCTAssertThrowsError(try LocalDataStore.prepareBackup(data: invalid))
    do {
      _ = try await repository.importBackupPackageData(invalid)
      XCTFail("Incomplete backups must not replace current records")
    } catch { }
    let unchanged = try await repository.fetchAppData()
    XCTAssertEqual(unchanged.purchases, original.purchases)
  }

  func testBackupExportReportsMissingLocalPhotoInsteadOfSilentlyOmittingIt() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    _ = try await repository.createPurchase(PurchaseInput(categoryName: "其他",
      gearCoverImageUrl: "badminton-gear-photo:///\(UUID().uuidString).jpg", itemNameSnapshot: "照片缺失的装备",
      unitPriceCny: 10, quantity: 1, purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .stored))
    XCTAssertThrowsError(try repository.exportBackupPackageData())
    XCTAssertThrowsError(try repository.exportBackupPackage())
  }

  func testBackupPreviewDoesNotMutateRecordsAndRejectsMissingPhotos() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    _ = try await repository.createPurchase(PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "原始记录",
      unitPriceCny: 100, quantity: 2, purchaseDate: "2026-10-08T00:00:00Z", itemStatus: .inUse))
    let backup = try repository.exportBackupPackageData()
    let preview = try LocalDataStore.prepareBackup(data: backup)
    XCTAssertEqual(preview.purchaseCount, 1)
    XCTAssertEqual(preview.photoCount, 0)
    let unchanged = try await repository.fetchAppData()
    XCTAssertEqual(unchanged.purchases.count, 1)
    var json = try XCTUnwrap(JSONSerialization.jsonObject(with: backup) as? [String: Any])
    json["files"] = [["originalURLString": "file:///missing.png", "relativePath": "photos/missing.png"]]
    XCTAssertThrowsError(try LocalDataStore.prepareBackup(data: JSONSerialization.data(withJSONObject: json)))
    json["files"] = []
    var snapshot = try XCTUnwrap(json["data"] as? [String: Any])
    let purchases = try XCTUnwrap(snapshot["purchases"] as? [[String: Any]])
    snapshot["purchases"] = purchases + purchases
    json["data"] = snapshot
    XCTAssertThrowsError(try LocalDataStore.prepareBackup(data: JSONSerialization.data(withJSONObject: json)))
  }

  func testInvalidBackupVersionsAndDuplicateRecordsLeaveCurrentDataUnchanged() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    _ = try await repository.createPurchase(PurchaseInput(categoryName: "其他", itemNameSnapshot: "保留数据",
      unitPriceCny: 100, quantity: 1, purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    let original = try await repository.fetchAppData()
    let valid = try XCTUnwrap(JSONSerialization.jsonObject(with: repository.exportBackupPackageData()) as? [String: Any])
    var future = valid
    future["formatVersion"] = 999
    var duplicates = valid
    var snapshot = try XCTUnwrap(duplicates["data"] as? [String: Any])
    let purchases = try XCTUnwrap(snapshot["purchases"] as? [[String: Any]])
    snapshot["purchases"] = purchases + purchases
    duplicates["data"] = snapshot
    for object in [future, duplicates] {
      let data = try JSONSerialization.data(withJSONObject: object)
      XCTAssertThrowsError(try LocalDataStore.prepareBackup(data: data))
      do { _ = try await repository.importBackupPackageData(data); XCTFail("Invalid backup must fail") } catch { }
      let current = try await repository.fetchAppData()
      XCTAssertEqual(current.purchases, original.purchases)
    }
    let legacy = try LocalDataStore.prepareBackup(data: repository.exportBackupData(), isLegacy: true)
    let restored = try await makeIsolatedRepository(container: try BadmintonDataContainer.inMemory()).importBackupData(legacy.data)
    XCTAssertEqual(restored.purchases, original.purchases)
  }

  func testPegboardReusesPreparedLayoutAndRefreshesWhenInputsChange() async {
    let model = PegboardRenderModel()
    let items = PreviewData.gearWallItems
    let active = PegboardRenderInput(items: items, purchases: [], sortOrder: .automatic,
      mode: .active, savedSnapshot: nil, width: 370)
    await model.render(active)
    await model.render(active)
    XCTAssertEqual(model.renderCount, 1)
    let history = PegboardRenderInput(items: items, purchases: [], sortOrder: .automatic,
      mode: .history, savedSnapshot: nil, width: 370)
    await model.render(history)
    await model.render(active)
    XCTAssertEqual(model.renderCount, 2)
    await model.render(PegboardRenderInput(items: items, purchases: [], sortOrder: .brand,
      mode: .active, savedSnapshot: nil, width: 600))
    XCTAssertEqual(model.renderCount, 3)
    await model.render(PegboardRenderInput(items: Array(items.prefix(1)), purchases: [], sortOrder: .automatic,
      mode: .active, savedSnapshot: nil, width: 370))
    XCTAssertEqual(model.renderCount, 4)
    XCTAssertFalse(model.isRendering)
  }

  func testFailedPhotoRestoreRemovesStagedFilesAndPreservesCurrentRecords() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    _ = try await repository.createPurchase(PurchaseInput(categoryName: "其他", itemNameSnapshot: "保留记录",
      unitPriceCny: 100, quantity: 1, purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    let original = try await repository.fetchAppData()
    var json = try XCTUnwrap(JSONSerialization.jsonObject(with: repository.exportBackupPackageData()) as? [String: Any])
    let id = UUID().uuidString.lowercased()
    let bytes = Data("photo".utf8).base64EncodedString()
    json["files"] = [
      ["originalURLString": "badminton-media:///\(id)/original.jpg", "relativePath": "photos/a.jpg", "dataBase64": bytes],
      ["originalURLString": "badminton-media:///\(id)/unsupported.png", "relativePath": "photos/b.png", "dataBase64": bytes]
    ]
    let root = LocalMediaStorage().rootURL
    let before = Set((try? FileManager.default.contentsOfDirectory(atPath: root.path)) ?? [])
    do {
      _ = try await repository.importBackupPackageData(JSONSerialization.data(withJSONObject: json))
      XCTFail("Invalid media must not be committed")
    } catch { }
    XCTAssertEqual(Set((try? FileManager.default.contentsOfDirectory(atPath: root.path)) ?? []), before)
    let current = try await repository.fetchAppData()
    XCTAssertEqual(current.purchases, original.purchases)
  }

  func testImageLoaderDownsamplesAndSharesConcurrentRequests() async throws {
    let url = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".png")
    defer { try? FileManager.default.removeItem(at: url) }
    let image = UIGraphicsImageRenderer(size: CGSize(width: 1800, height: 2600)).image { context in
      UIColor.systemBlue.setFill()
      context.fill(CGRect(x: 0, y: 0, width: 1800, height: 2600))
    }
    try XCTUnwrap(image.pngData()).write(to: url)
    let request = GearImageRequest(imageKey: nil, coverImageUrl: url.absoluteString, categoryName: nil, maxPixelSize: 256)
    async let first = GearImageLoader.image(for: request)
    async let second = GearImageLoader.image(for: request)
    let (a, b) = await (first, second)
    let prepared = try XCTUnwrap(a)
    XCTAssertTrue(prepared === b)
    XCTAssertTrue(prepared === GearImageLoader.cachedImage(for: request))
    XCTAssertLessThanOrEqual(max(prepared.cgImage?.width ?? 0, prepared.cgImage?.height ?? 0), 256)
  }

  func testCachedSpendingAndAnalyticsRefreshAfterRecordAndWishlistChanges() async throws {
    let session = AppSession(repository: makeIsolatedRepository(container: try BadmintonDataContainer.inMemory()))
    await session.refreshAll()
    XCTAssertTrue(session.spendingEntries.isEmpty)
    XCTAssertTrue(session.analytics(for: "all").brandShare.isEmpty)
    let saved = await session.createPurchase(PurchaseInput(categoryName: "其他", itemNameSnapshot: "统计更新",
      unitPriceCny: 100, quantity: 1, purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .inUse))
    XCTAssertTrue(saved)
    XCTAssertEqual(session.spendingEntries.reduce(0) { $0 + ($1.amount ?? 0) }, 100)
    XCTAssertEqual(session.analytics(for: "all").brandShare.reduce(0) { $0 + $1.amount }, 100)
    let purchase = try XCTUnwrap(session.purchases.first)
    let edited = await session.updatePurchaseRecord(id: purchase.id, input: PurchaseEditInput(unitPriceCny: 250,
      quantity: 1, purchaseDate: purchase.purchaseDate, itemStatus: .inUse))
    XCTAssertTrue(edited)
    XCTAssertEqual(session.spendingEntries.reduce(0) { $0 + ($1.amount ?? 0) }, 250)
    XCTAssertEqual(session.analytics(for: "all").brandShare.reduce(0) { $0 + $1.amount }, 250)
    let wished = await session.createWishlistItem(WishlistEditInput(name: "统计心愿", priority: 3, status: .want))
    XCTAssertTrue(wished)
    XCTAssertEqual(session.analytics(for: "all").wishlistCounts.reduce(0) { $0 + $1.count }, 1)
  }

  func testBackupRestoreKeepsRecoveryPointAndRecoversFromImportFailure() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let folder = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: folder) }
    let recoveryURL = folder.appending(path: "recovery.btbackup")
    let session = AppSession(repository: repository, recoveryURL: recoveryURL)
    let saved = await session.createPurchase(PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "保留的记录",
      unitPriceCny: 100, quantity: 2, purchaseDate: "2026-10-08T00:00:00Z", itemStatus: .inUse))
    XCTAssertTrue(saved)
    let invalid = PreparedBackup(data: Data("invalid".utf8), isLegacy: false, purchaseCount: 0,
      wishlistCount: 0, photoCount: 0, exportedAt: nil)
    let failed = await session.restorePreparedBackup(invalid)
    XCTAssertFalse(failed)
    XCTAssertEqual(session.purchases.first?.itemNameSnapshot, "保留的记录")
    let recovery = try LocalDataStore.prepareBackup(data: Data(contentsOf: recoveryURL))
    XCTAssertEqual(recovery.purchaseCount, 1)
    let emptyRepository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let emptyBackup = try LocalDataStore.prepareBackup(data: emptyRepository.exportBackupPackageData())
    let restored = await session.restorePreparedBackup(emptyBackup)
    XCTAssertTrue(restored)
    XCTAssertTrue(session.purchases.isEmpty)
    XCTAssertEqual(try LocalDataStore.prepareBackup(data: Data(contentsOf: recoveryURL)).purchaseCount, 1)
  }

  func testWishlistUndoRestoresIdentityAndPriceTimestamp() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let session = AppSession(repository: repository)
    let input = WishlistEditInput(name: "训练球", targetPriceCny: 90, currentSeenPriceCny: 100,
      priority: 3, status: .want, sourceUrl: nil, imageUrl: nil, notes: "保留备注", brandName: "YONEX", categoryName: "羽毛球")
    let saved = await session.createWishlistItem(input)
    XCTAssertTrue(saved)
    let original = try XCTUnwrap(session.wishlistItems.first)
    XCTAssertNotNil(original.priceRecordedAt)
    let edited = await session.updateWishlistItem(id: original.id, input: input)
    XCTAssertTrue(edited)
    XCTAssertEqual(session.wishlistItems.first?.priceRecordedAt, original.priceRecordedAt)
    let deleted = await session.deleteWishlistItem(id: original.id)
    XCTAssertTrue(deleted)
    XCTAssertTrue(session.wishlistItems.isEmpty)
    let restored = await session.undoLastOperation()
    XCTAssertTrue(restored)
    XCTAssertEqual(session.wishlistItems.first, original)
    let again = await session.undoLastOperation()
    XCTAssertFalse(again)
    let persisted = try await repository.fetchAppData()
    XCTAssertEqual(persisted.wishlistItems.first, original)
  }

  func testConsumptionUndoKeepsSubsequentEdits() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    let session = AppSession(repository: repository)
    let saved = await session.createPurchase(PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "训练球",
      unitPriceCny: 100, quantity: 5, purchaseDate: "2026-01-01T00:00:00Z", itemStatus: .stored))
    XCTAssertTrue(saved)
    let purchase = try XCTUnwrap(session.purchases.first)
    let first = ConsumptionRecord(quantity: 1, finishedDate: "2026-02-01T00:00:00Z")
    let later = ConsumptionRecord(quantity: 1, finishedDate: "2026-03-01T00:00:00Z")
    let updated = await session.updatePurchaseRecord(id: purchase.id, input: PurchaseEditInput(
      consumptionRecords: [first, later], unitPriceCny: 95, quantity: 5,
      purchaseDate: purchase.purchaseDate, statusDate: nil, channel: "京东", itemStatus: .stored, notes: "后续修改"))
    XCTAssertTrue(updated)
    session.undoOperation = .consumption(purchaseID: purchase.id, recordID: first.id, originalStatus: .stored)
    let undone = await session.undoLastOperation()
    XCTAssertTrue(undone)
    let result = try XCTUnwrap(session.purchases.first)
    XCTAssertEqual(result.consumptionHistory, [later])
    XCTAssertEqual(result.remainingQuantity, 4)
    XCTAssertEqual(result.unitPriceCny, 95)
    XCTAssertEqual(result.notes, "后续修改")
    XCTAssertEqual(result.channel, "京东")
  }

  func testDraftsAreIsolatedAndMalformedDraftsAreIgnored() throws {
    let suite = "draft-test-" + UUID().uuidString
    let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
    defer { defaults.removePersistentDomain(forName: suite) }
    let values = (0..<22).map(String.init)
    PurchaseDraftStore.save(values, key: "custom", defaults: defaults)
    XCTAssertEqual(PurchaseDraftStore.load(key: "custom", defaults: defaults), values)
    XCTAssertNil(PurchaseDraftStore.load(key: "catalog", defaults: defaults))
    defaults.set(["broken"], forKey: "purchase.draft.v1.broken")
    XCTAssertNil(PurchaseDraftStore.load(key: "broken", defaults: defaults))
    PurchaseDraftStore.remove(key: "custom", defaults: defaults)
    XCTAssertNil(PurchaseDraftStore.load(key: "custom", defaults: defaults))
  }

  func testMonthlyAnalyticsFillsGapsAndReconcilesDrilldown() async throws {
    let repository = makeIsolatedRepository(container: try BadmintonDataContainer.inMemory())
    _ = try await repository.createPurchase(PurchaseInput(categoryName: "羽毛球", itemNameSnapshot: "训练球",
      unitPriceCny: 100, quantity: 2, purchaseDate: "2026-01-02T00:00:00Z", itemStatus: .inUse))
    let data = try await repository.createPurchase(PurchaseInput(categoryName: "球拍", itemNameSnapshot: "球拍",
      unitPriceCny: 500, quantity: 1, purchaseDate: "2026-03-02T00:00:00Z", itemStatus: .inUse))
    let analytics = LocalDataStore.makeAnalytics(from: data.purchases, wishlistItems: [], range: "2026")
    XCTAssertEqual(analytics.trend.count, 12)
    XCTAssertEqual(analytics.trend.first { $0.bucket == "2026-02" }?.amount, 0)
    XCTAssertEqual(analytics.frequency.first { $0.bucket == "2026-02" }?.count, 0)
    for point in analytics.trend {
      let records = AnalyticsPurchaseFilter(range: "2026", dimension: .period(point.bucket)).records(in: data.purchases)
      XCTAssertEqual(point.amount, records.reduce(0) { $0 + $1.totalPriceCny })
    }
    XCTAssertEqual(analytics.trend.reduce(0) { $0 + $1.amount }, 700)
  }

  func testAnalyticsPerformanceForFiveThousandPurchases() {
    let purchases = (0..<5000).map { index in
      PurchaseRecord(id: String(index), itemNameSnapshot: "训练球", unitPriceCny: 100,
        quantity: 2, totalPriceCny: 200, itemStatus: .inUse,
        purchaseDate: "2026-05-10T00:00:00Z", channel: "京东", notes: nil,
        brand: PreviewData.brandYonex, category: PreviewData.categoryShuttle, gearItem: nil)
    }
    measure {
      let analytics = LocalDataStore.makeAnalytics(from: purchases, wishlistItems: [], range: "2026")
      XCTAssertEqual(analytics.trend.reduce(0) { $0 + $1.amount }, 1_000_000)
    }
  }

  private func makeIsolatedRepository(container: ModelContainer) -> LocalEquipmentRepository {
    let unusedLegacyURL = FileManager.default.temporaryDirectory
      .appending(path: UUID().uuidString, directoryHint: .isDirectory)
      .appending(path: "local-data.json")
    return LocalEquipmentRepository(
      container: container,
      legacyFileURL: unusedLegacyURL,
      bundle: seedBundle
    )
  }

  func testImportedTubePhotoKeepsOriginalAndProducesSeparateCutout() async throws {
    let image = UIGraphicsImageRenderer(size: CGSize(width: 400, height: 600)).image { context in
      UIColor.white.setFill()
      context.fill(CGRect(x: 0, y: 0, width: 400, height: 600))
      UIColor.darkGray.setFill()
      UIBezierPath(roundedRect: CGRect(x: 160, y: 50, width: 80, height: 500), cornerRadius: 15).fill()
    }
    let result = try await GearPhotoProcessor.processImportedImage(image, categoryName: "羽毛球")
    defer { try? GearPhotoProcessor.deleteMedia(id: result.mediaID) }
    let cutoutURL = try XCTUnwrap(result.cutoutURL)
    XCTAssertNotEqual(result.originalURL, cutoutURL)
    XCTAssertTrue(FileManager.default.fileExists(atPath: result.originalURL.path))
    XCTAssertNotNil(GearPhotoProcessor.originalImage(for: result.displayReference))
    let processed = try XCTUnwrap(GearPhotoProcessor.processedImage(for: result.displayReference))
    XCTAssertLessThan(processed.size.width, image.size.width)
    let archived = try GearPhotoProcessor.archiveMedia(for: result.displayReference)
    XCTAssertEqual(archived.count, 3)
  }

  func testMediaStorageUsesRelativePathsAndKeepsOriginalSeparate() throws {
    let temporaryRoot = FileManager.default.temporaryDirectory
      .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let legacyRoot = FileManager.default.temporaryDirectory
      .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    defer { try? FileManager.default.removeItem(at: temporaryRoot) }
    defer { try? FileManager.default.removeItem(at: legacyRoot) }

    let storage = LocalMediaStorage(rootURL: temporaryRoot, legacyPhotosURL: legacyRoot)
    let id = UUID()
    let folder = try storage.makeAssetDirectory(id: id)
    let original = folder.appending(path: "original.jpg")
    let processed = folder.appending(path: "processed.png")
    let thumbnail = folder.appending(path: "thumbnail.jpg")
    try Data("original".utf8).write(to: original)
    try Data("processed".utf8).write(to: processed)
    try Data("thumbnail".utf8).write(to: thumbnail)

    let processedPath = try XCTUnwrap(storage.relativePath(for: processed))
    XCTAssertFalse(processedPath.hasPrefix("/"))
    let reference = storage.reference(forRelativePath: processedPath)
    XCTAssertFalse(reference.contains(temporaryRoot.path))

    let files = try XCTUnwrap(storage.files(forReference: reference))
    XCTAssertNotEqual(files.originalRelativePath, files.processedRelativePath)
    XCTAssertEqual(storage.resolveReference(reference), processed)

    let reloadedStorage = LocalMediaStorage(rootURL: temporaryRoot, legacyPhotosURL: legacyRoot)
    XCTAssertEqual(reloadedStorage.resolveReference(reference), processed)
    try reloadedStorage.removeAsset(id: id)
    XCTAssertFalse(FileManager.default.fileExists(atPath: folder.path))
  }
}

@MainActor
private struct FailingSubmissionRepository: EquipmentRepository {
  enum Failure: Error { case expected }
  func fetchCatalogEquipment() async throws -> [CatalogEquipment] { throw Failure.expected }
  func searchCatalogEquipment(keyword: String) async throws -> [CatalogEquipment] { throw Failure.expected }
  func fetchUserEquipment() async throws -> [UserEquipment] { throw Failure.expected }
  func createUserEquipment(_ equipment: UserEquipment) async throws { throw Failure.expected }
  func updateUserEquipment(_ equipment: UserEquipment) async throws { throw Failure.expected }
  func deleteUserEquipment(id: UUID) async throws { throw Failure.expected }
  func fetchMediaAssets(ownerID: UUID) async throws -> [MediaAsset] { throw Failure.expected }
  func fetchAppData() async throws -> LocalAppData { throw Failure.expected }
  func createPurchase(_ input: PurchaseInput) async throws -> LocalAppData { throw Failure.expected }
  func purchaseWishlistItem(id: String, purchaseInput: PurchaseInput) async throws -> LocalAppData { throw Failure.expected }
  func updateGearItem(id: String, input: GearEditInput) async throws -> LocalAppData { throw Failure.expected }
  func updatePurchaseRecord(id: String, input: PurchaseEditInput) async throws -> LocalAppData { throw Failure.expected }
  func deletePurchaseRecord(id: String) async throws -> LocalAppData { throw Failure.expected }
  func createWishlistItem(_ input: WishlistEditInput) async throws -> LocalAppData { throw Failure.expected }
  func updateWishlistItem(id: String, input: WishlistEditInput) async throws -> LocalAppData { throw Failure.expected }
  func deleteWishlistItem(id: String) async throws -> LocalAppData { throw Failure.expected }
  func deleteGearItem(id: String) async throws -> LocalAppData { throw Failure.expected }
  func reset() async throws -> LocalAppData { throw Failure.expected }
  func exportBackupData() throws -> Data { throw Failure.expected }
  func exportBackupPackage() throws -> FileWrapper { throw Failure.expected }
  func exportBackupPackageData() throws -> Data { throw Failure.expected }
  func importBackupData(_ data: Data) async throws -> LocalAppData { throw Failure.expected }
  func importBackupPackage(at url: URL) async throws -> LocalAppData { throw Failure.expected }
  func importBackupPackageData(_ data: Data) async throws -> LocalAppData { throw Failure.expected }
}
