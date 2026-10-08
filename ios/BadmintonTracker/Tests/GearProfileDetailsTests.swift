import Foundation

@main
struct GearProfileDetailsTests {
  static func main() throws {
    try decodesLegacyGearSummaryWithoutProfileDetails()
    try roundTripsRacketProfileDetails()
    try parsesFractionalISODate()
    try roundTripsPurchaseStatusDate()
    validatesRacketSpecOptions()
    validatesRacketStringOptions()
    updatesRacketStringingHistory()
    validatesPurchaseChannelOptions()
    filtersPegboardDisplayableCategories()
    calculatesEffectiveUnitPriceForImportedPurchases()
    buildsStableChartYAxisScale()
    try preservesStringingRecordCostAndChannel()
    normalizesPurchaseChannelForAnalysis()
    try mergesSameGearAcrossNonAdjacentPurchases()
    replacesWishlistStatusWithoutLosingFields()
  }

  private static func decodesLegacyGearSummaryWithoutProfileDetails() throws {
    let data = """
    {
      "id": "gear-1",
      "modelCode": "ARC11 PRO",
      "coverImageUrl": null,
      "imageKey": "yonex_racket_arcsaber11pro_main_01"
    }
    """.data(using: .utf8)!

    let summary = try JSONDecoder().decode(GearSummary.self, from: data)
    assert(summary.id == "gear-1")
    assert(summary.profileDetails == nil)
  }

  private static func roundTripsRacketProfileDetails() throws {
    let details = GearProfileDetails.racket(RacketGearDetails(
      weightSpec: "4U",
      gripSpec: "G5",
      currentString: "BG80",
      mainTension: 27,
      crossTension: 25,
      stringingDate: "2026-06-16T00:00:00Z",
      stringHistory: [
        StringingRecord(
          id: StableUUID.from("string-1"),
          stringName: "BG80",
          mainTension: 27,
          crossTension: 25,
          stringingDate: "2026-06-16T00:00:00Z",
          notes: "首次穿线"
        )
      ]
    ))
    let summary = GearSummary(
      id: "gear-1",
      modelCode: "ARC11 PRO",
      coverImageUrl: nil,
      imageKey: "yonex_racket_arcsaber11pro_main_01",
      profileDetails: details
    )

    let data = try JSONEncoder().encode(summary)
    let decoded = try JSONDecoder().decode(GearSummary.self, from: data)
    assert(decoded.profileDetails == details)
  }

  private static func parsesFractionalISODate() throws {
    let date = AppDate.parseISODate("2026-05-10T08:00:00.000Z")
    assert(date != nil)
  }

  private static func roundTripsPurchaseStatusDate() throws {
    let legacyData = """
    {
      "id": "purchase-1",
      "itemNameSnapshot": "亚狮龙 3号",
      "unitPriceCny": 98,
      "quantity": 1,
      "totalPriceCny": 98,
      "itemStatus": "IN_USE",
      "purchaseDate": "2026-05-10T08:00:00.000Z"
    }
    """.data(using: .utf8)!
    let legacy = try JSONDecoder().decode(PurchaseRecord.self, from: legacyData)
    assert(legacy.statusDate == nil)

    let record = PurchaseRecord(
      id: "purchase-2",
      itemNameSnapshot: "亚狮龙 3号",
      unitPriceCny: 98,
      quantity: 1,
      totalPriceCny: 98,
      itemStatus: .usedUp,
      purchaseDate: "2026-05-10T08:00:00.000Z",
      statusDate: "2026-06-16T08:00:00Z",
      channel: nil,
      notes: nil,
      brand: nil,
      category: nil,
      gearItem: nil
    )
    let data = try JSONEncoder().encode(record)
    let decoded = try JSONDecoder().decode(PurchaseRecord.self, from: data)
    assert(decoded.statusDate == "2026-06-16T08:00:00Z")
    assert(decoded.purchaseDate == "2026-05-10T08:00:00.000Z")
  }

  private static func replacesWishlistStatusWithoutLosingFields() {
    assert(WishlistStatus.want.isActive)
    assert(WishlistStatus.watching.isActive)
    assert(!WishlistStatus.purchased.isActive)
    assert(!WishlistStatus.dropped.isActive)

    let item = WishlistItem(
      id: "wishlist-1",
      name: "弓箭 11 Pro",
      targetPriceCny: 1400,
      currentSeenPriceCny: 1499,
      priority: 5,
      status: .watching,
      sourceUrl: "https://example.com/item",
      imageUrl: "https://example.com/item.png",
      notes: "等活动",
      brand: NamedRef(id: "brand-yonex", name: "YONEX"),
      category: NamedRef(id: "category-racket", name: "球拍")
    )

    let purchased = item.replacingStatus(.purchased)
    assert(purchased.status == .purchased)
    assert(purchased.id == item.id)
    assert(purchased.name == item.name)
    assert(purchased.targetPriceCny == item.targetPriceCny)
    assert(purchased.currentSeenPriceCny == item.currentSeenPriceCny)
    assert(purchased.sourceUrl == item.sourceUrl)
    assert(purchased.brand == item.brand)
    assert(purchased.category == item.category)
  }

  private static func validatesRacketSpecOptions() {
    assert(RacketSpecOptions.weightSpecs == ["2U", "3U", "4U", "5U", "6U"])
    assert(RacketSpecOptions.gripSpecs == ["G4", "G5", "G6"])
    assert(RacketSpecOptions.normalizedWeightSpec("4u") == "4U")
    assert(RacketSpecOptions.normalizedGripSpec("g5") == "G5")
  }

  private static func validatesRacketStringOptions() {
    assert(RacketStringOptions.popularStrings.contains("YONEX BG80"))
    assert(RacketStringOptions.popularStrings.contains("YONEX EXBOLT 65"))
    assert(RacketStringOptions.normalizedStringName("bg80") == "YONEX BG80")
    assert(RacketStringOptions.normalizedStringName("李宁 1号线") == "李宁 1号线")
  }

  private static func updatesRacketStringingHistory() {
    let first = StringingRecord(
      id: StableUUID.from("string-1"),
      stringName: "YONEX BG80",
      mainTension: 27,
      crossTension: 25,
      stringingDate: "2026-05-01T00:00:00Z",
      notes: nil
    )
    let second = StringingRecord(
      id: StableUUID.from("string-2"),
      stringName: "YONEX EXBOLT 65",
      mainTension: 26,
      crossTension: 24,
      stringingDate: "2026-06-01T00:00:00Z",
      notes: nil
    )
    let details = RacketGearDetails(
      weightSpec: "4U",
      gripSpec: "G5",
      currentString: second.stringName,
      mainTension: second.mainTension,
      crossTension: second.crossTension,
      stringingDate: second.stringingDate,
      stringHistory: [first, second]
    )

    let editedFirst = StringingRecord(
      id: first.id,
      stringName: "YONEX BG80 Power",
      mainTension: 28,
      crossTension: 26,
      stringingDate: first.stringingDate,
      notes: "高磅"
    )
    let edited = details.replacingStringingRecord(editedFirst)
    assert(edited.stringHistory.first { $0.id == first.id }?.stringName == "YONEX BG80 Power")
    assert(edited.currentString == second.stringName)

    let afterDeletingLatest = edited.removingStringingRecord(id: second.id)
    assert(afterDeletingLatest.stringHistory.count == 1)
    assert(afterDeletingLatest.currentString == editedFirst.stringName)
    assert(afterDeletingLatest.mainTension == editedFirst.mainTension)

    let empty = afterDeletingLatest.removingStringingRecord(id: first.id)
    assert(empty.stringHistory.isEmpty)
    assert(empty.currentString == nil)
    assert(empty.mainTension == nil)
    assert(empty.crossTension == nil)
    assert(empty.stringingDate == nil)
  }

  private static func validatesPurchaseChannelOptions() {
    assert(PurchaseChannelOptions.presets == ["淘宝", "京东", "拼多多", "得物", "抖音", "小红书", "闲鱼", "线下", "朋友转让"])
    assert(PurchaseChannelOptions.normalizedPreset("拼多多") == "拼多多")
    assert(PurchaseChannelOptions.normalizedPreset("pdd") == "拼多多")
    assert(PurchaseChannelOptions.normalizedPreset("线下门店") == "线下")
    assert(PurchaseChannelOptions.normalizedPreset("球馆店") == "线下")
    assert(PurchaseChannelOptions.normalizedPreset("俱乐部团购") == "线下")
    assert(PurchaseChannelOptions.normalizedPreset("初始导入") == nil)
  }

  private static func filtersPegboardDisplayableCategories() {
    assert(gearWallItem(categoryName: "羽毛球").isPegboardDisplayable)
    assert(gearWallItem(categoryName: "球拍").isPegboardDisplayable)
    assert(gearWallItem(categoryName: "球鞋").isPegboardDisplayable)
    assert(!gearWallItem(categoryName: "其他").isPegboardDisplayable)
    assert(!gearWallItem(categoryName: "配件").isPegboardDisplayable)
  }

  private static func gearWallItem(categoryName: String) -> GearWallItem {
    GearWallItem(
      id: "gear-\(categoryName)",
      name: categoryName,
      coverImageUrl: nil,
      imageKey: nil,
      modelCode: nil,
      createdAt: nil,
      latestPurchaseDate: nil,
      referenceUnitPriceCny: nil,
      brand: nil,
      category: NamedRef(id: nil, name: categoryName),
      profileDetails: nil,
      ratings: [],
      totalQuantity: 1,
      activeQuantity: 1,
      usedUpQuantity: 0,
      wornOutQuantity: 0
    )
  }

  private static func calculatesEffectiveUnitPriceForImportedPurchases() {
    let imported = PurchaseRecord(
      id: "purchase-imported",
      itemNameSnapshot: "亚狮龙 3号",
      unitPriceCny: 0,
      quantity: 2,
      totalPriceCny: 164,
      itemStatus: .inUse,
      purchaseDate: "2026-06-16T00:00:00Z",
      channel: nil,
      notes: nil,
      brand: NamedRef(id: nil, name: "RSL"),
      category: NamedRef(id: nil, name: "羽毛球"),
      gearItem: nil
    )
    let normal = PurchaseRecord(
      id: "purchase-normal",
      itemNameSnapshot: "亚狮龙 3号",
      unitPriceCny: 82,
      quantity: 2,
      totalPriceCny: 164,
      itemStatus: .inUse,
      purchaseDate: "2026-06-16T00:00:00Z",
      channel: nil,
      notes: nil,
      brand: NamedRef(id: nil, name: "RSL"),
      category: NamedRef(id: nil, name: "羽毛球"),
      gearItem: nil
    )

    assert(imported.effectiveUnitPriceCny == 82)
    assert(normal.effectiveUnitPriceCny == 82)
  }

  private static func buildsStableChartYAxisScale() {
    let moneyScale = AnalyticsYAxisScale.make(maxValue: 1289, desiredTickCount: 4)
    assert(moneyScale.domain == 0...1500)
    assert(moneyScale.marks == [0, 500, 1000, 1500])

    let countScale = AnalyticsYAxisScale.make(maxValue: 3, desiredTickCount: 3, forceIntegerSteps: true)
    assert(countScale.domain == 0...3)
    assert(countScale.marks == [0, 1, 2, 3])

    let emptyScale = AnalyticsYAxisScale.make(maxValue: 0)
    assert(emptyScale.domain == 0...1)
    assert(emptyScale.marks == [0, 1])
  }

  private static func preservesStringingRecordCostAndChannel() throws {
    let data = """
    {
      "id": "string-1",
      "stringName": "YONEX BG80",
      "mainTension": 27,
      "crossTension": 25,
      "stringingDate": "2026-06-16T00:00:00Z",
      "costCny": 88,
      "channel": "线下门店",
      "notes": "含球线"
    }
    """.data(using: .utf8)!

    let record = try JSONDecoder().decode(StringingRecord.self, from: data)
    assert(record.costCny == 88)
    assert(record.normalizedChannel == "线下")

    let legacyData = """
    {
      "id": "string-legacy",
      "stringName": "YONEX BG65",
      "stringingDate": "2026-05-01T00:00:00Z"
    }
    """.data(using: .utf8)!
    let legacy = try JSONDecoder().decode(StringingRecord.self, from: legacyData)
    assert(legacy.costCny == nil)
    assert(legacy.channel == nil)
  }

  private static func normalizesPurchaseChannelForAnalysis() {
    let purchase = PurchaseRecord(
      id: "purchase-channel",
      itemNameSnapshot: "亚狮龙 3号",
      unitPriceCny: 82,
      quantity: 2,
      totalPriceCny: 164,
      itemStatus: .inUse,
      purchaseDate: "2026-06-16T00:00:00Z",
      channel: "球馆店",
      notes: nil,
      brand: NamedRef(id: nil, name: "RSL"),
      category: NamedRef(id: nil, name: "羽毛球"),
      gearItem: nil
    )

    assert(purchase.normalizedChannelName == "线下")
  }

  private static func mergesSameGearAcrossNonAdjacentPurchases() throws {
    let seedURL = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
      .appendingPathComponent("../BadmintonTracker/Resources/Seed/equipment_catalog.json")
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    let entries = try decoder.decode(CatalogSeedFile.self, from: Data(contentsOf: seedURL))
      .equipment.filter(\.isActive).map(LocalGearCatalogEntry.init)
    assert(!entries.isEmpty)
    let importedF6 = PurchaseRecord(
      id: "purchase-imported-f6",
      itemNameSnapshot: "翎美 F6",
      unitPriceCny: 88,
      quantity: 1,
      totalPriceCny: 88,
      itemStatus: .usedUp,
      purchaseDate: "2025-02-19T00:00:00Z",
      channel: nil,
      notes: nil,
      brand: NamedRef(id: "remote-brand-lingmei", name: "翎美"),
      category: NamedRef(id: "remote-category-shuttle", name: "羽毛球"),
      gearItem: GearSummary(
        id: "remote-gear-f6",
        modelCode: "F6",
        coverImageUrl: nil,
        imageKey: "lingmei_shuttlecock_f6_cutout_01"
      )
    )
    let interveningPurchase = PurchaseRecord(
      id: "purchase-rsl-1",
      itemNameSnapshot: "亚狮龙 1号",
      unitPriceCny: 145,
      quantity: 1,
      totalPriceCny: 145,
      itemStatus: .inUse,
      purchaseDate: "2025-06-01T00:00:00Z",
      channel: nil,
      notes: nil,
      brand: NamedRef(id: "local-brand-rsl", name: "RSL"),
      category: NamedRef(id: "local-category-shuttle", name: "羽毛球"),
      gearItem: GearSummary(
        id: "local-gear-rsl-1",
        modelCode: "No.1",
        coverImageUrl: nil,
        imageKey: "rsl_shuttlecock_no1_main_01"
      )
    )
    let localF6 = PurchaseRecord(
      id: "purchase-local-f6",
      itemNameSnapshot: "翎美F6",
      unitPriceCny: 92,
      quantity: 2,
      totalPriceCny: 184,
      itemStatus: .inUse,
      purchaseDate: "2026-02-19T00:00:00Z",
      channel: nil,
      notes: nil,
      brand: NamedRef(id: "local-brand-lingmei", name: "lingmei"),
      category: NamedRef(id: "local-category-shuttle", name: "羽毛球"),
      gearItem: GearSummary(
        id: "local-gear-lingmei-f6",
        modelCode: nil,
        coverImageUrl: nil,
        imageKey: "lingmei_shuttlecock_f6_cutout_01"
      )
    )
    let differentModel = PurchaseRecord(
      id: "purchase-f6-pro",
      itemNameSnapshot: "翎美 F6",
      unitPriceCny: 108,
      quantity: 1,
      totalPriceCny: 108,
      itemStatus: .inUse,
      purchaseDate: "2026-03-01T00:00:00Z",
      channel: nil,
      notes: nil,
      brand: NamedRef(id: "local-brand-lingmei", name: "翎美"),
      category: NamedRef(id: "local-category-shuttle", name: "羽毛球"),
      gearItem: GearSummary(
        id: "local-gear-lingmei-f6-pro",
        modelCode: "F6 Pro",
        coverImageUrl: nil,
        imageKey: nil
      )
    )

    let purchases = [importedF6, interveningPurchase, localF6, differentModel]
    let groups = Dictionary(grouping: purchases, by: { LocalGearIdentity.id(for: $0, entries: entries) })
    let f6ID = LocalGearIdentity.id(for: importedF6, entries: entries)

    assert(groups.count == 3)
    assert(groups[f6ID]?.count == 2)
    assert(LocalGearIdentity.id(for: localF6, entries: entries) == f6ID)
    assert(LocalGearIdentity.id(for: interveningPurchase, entries: entries) != f6ID)
    assert(LocalGearIdentity.id(for: differentModel, entries: entries) != f6ID)
  }
}
