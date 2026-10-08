import Foundation

@main
struct GearPresentationTests {
  static func main() throws {
    let seed = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
      .appendingPathComponent("../BadmintonTracker/Resources/Seed/equipment_catalog.json")
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    let entries = try decoder.decode(CatalogSeedFile.self, from: Data(contentsOf: seed))
      .equipment.filter(\.isActive).map(LocalGearCatalogEntry.init)
    for name in ["YONEX ARCSABER 11 PRO", "弓箭 11 Pro", "弓11pro"] {
      assert(GearDisplayName.resolve(name: name, brand: "YONEX", model: "ARC11 PRO", category: "球拍",
        imageKey: nil, entries: entries) == "弓箭 11 Pro")
    }
    assert(GearDisplayName.resolve(name: "YONEX ARCSABER 11 PRO", brand: "YONEX", model: nil,
      category: "球拍", imageKey: nil, entries: []) == "弓箭 11 Pro")
    assert(GearDisplayName.resolve(name: "我的训练拍", brand: nil, model: nil,
      category: "球拍", imageKey: nil, entries: entries) == "我的训练拍")
    for name in ["YONEX ASTROX 88D PRO", "AX88D PRO", "88dpro", "天斧88dpro", "尤尼克斯 天斧 88D Pro"] {
      for catalog in [entries, []] {
        assert(GearDisplayName.resolve(name: name, brand: "YY", model: nil, category: "球拍",
          imageKey: nil, entries: catalog) == "天斧 88D Pro", name)
      }
    }
    for (name, expected) in [("ASTROX 77 PRO", "天斧 77 Pro"), ("AX100ZZ", "天斧 100ZZ"),
      ("ASTROX 88S TOUR", "天斧 88S Tour"), ("弓11pro", "弓箭 11 Pro"),
      ("ASTROX 88D PRO (黑)", "天斧 88D Pro (黑)")] {
      assert(GearDisplayName.resolve(name: name, brand: "YONEX", model: nil, category: "球拍",
        imageKey: nil, entries: entries) == expected)
    }
    assert(GearDisplayName.resolve(name: "88dpro", brand: "VICTOR", model: nil,
      category: "球拍", imageKey: nil, entries: entries) == "88dpro")
    assert(GearDisplayName.resolve(name: "88dpro", brand: "YONEX", model: nil,
      category: "球鞋", imageKey: nil, entries: entries) == "88dpro")
    assert(GearDisplayName.resolve(name: "88dpro", brand: nil, model: nil,
      category: nil, imageKey: nil, entries: []) == "88dpro")
    assert(LocalGearCatalog.entry(matchingName: "YONEX ASTROX 88D PRO", brandName: "YONEX",
      modelCode: nil, categoryName: "球拍", entries: entries)?.name == "天斧 88D Pro")
    for entry in entries where entry.brandName == "YONEX" && entry.categoryName == "球拍" {
      assert(!entry.name.contains("YONEX") && !entry.name.contains("ASTROX"))
      assert(GearDisplayName.resolve(name: entry.name, brand: entry.brandName, model: entry.modelCode,
        category: entry.categoryName, imageKey: nil, entries: entries) == entry.name)
    }
    for (name, expected) in [("VICTOR DriveX 12", "驭 12"), ("drivex12", "驭 12"),
      ("DX-12", "驭 12"), ("威克多 驭12", "驭 12"), ("驭 12", "驭 12"),
      ("VICTOR DriveX 12 (ZSW J)", "驭 12 (ZSW J)"), ("DX-12 ZSW J", "驭 12 (ZSW J)"),
      ("驭12（zswj）", "驭 12 (ZSW J)"), ("DriveX12 (黑)", "驭 12 (黑)")] {
      for catalog in [entries, []] {
        let actual = GearDisplayName.resolve(name: name, brand: "胜利", model: nil, category: "球拍",
          imageKey: nil, entries: catalog)
        assert(actual == expected, "\(name): \(actual)")
        assert(GearDisplayName.resolve(name: actual, brand: "VICTOR", model: nil, category: "球拍",
          imageKey: nil, entries: catalog) == expected)
      }
    }
    assert(GearDisplayName.resolve(name: "DriveX12", brand: "YONEX", model: nil, category: "球拍",
      imageKey: nil, entries: []) == "DriveX12")
    assert(GearDisplayName.resolve(name: "DriveX12", brand: "VICTOR", model: nil, category: "球鞋",
      imageKey: nil, entries: []) == "DriveX12")
    assert(GearDisplayName.resolve(name: "DriveX120", brand: "VICTOR", model: nil, category: "球拍",
      imageKey: nil, entries: []) == "DriveX120")
    assert(GearDisplayName.resolve(name: "旧进口记录", brand: "VICTOR", model: "DX-12 ZSW J", category: "球拍",
      imageKey: nil, entries: entries) == "驭 12 (ZSW J)")
    let victorEntry = LocalGearCatalog.entry(matchingName: "VICTOR DriveX 12 (ZSW J)", brandName: "VICTOR",
      modelCode: nil, categoryName: "球拍", entries: entries)
    assert(victorEntry?.name == "驭 12 (ZSW J)")
    assert(victorEntry?.searchText.contains("DriveX 12") == true)
    func item(_ brand: String, price: Double?, date: String? = nil) -> GearWallItem {
      GearWallItem(id: brand, name: brand, coverImageUrl: nil, imageKey: nil, modelCode: nil,
        createdAt: nil, latestPurchaseDate: date, referenceUnitPriceCny: price,
        brand: NamedRef(id: brand, name: brand), category: NamedRef(id: "racket", name: "球拍"),
        profileDetails: nil, ratings: [], totalQuantity: 1, activeQuantity: 1, usedUpQuantity: 0, wornOutQuantity: 0)
    }
    let items = [item("其他", price: nil), item("lining", price: 200, date: "2025-01-01T00:00:00Z"),
      item("victor", price: 400, date: "2026-01-01T00:00:00Z"), item("亚狮龙", price: 100), item("YONEX", price: 800)]
    assert(PegboardSortOrder.brand.sorted(items, purchases: []).map(\.id) == ["YONEX", "亚狮龙", "victor", "lining", "其他"])
    assert(PegboardSortOrder.priceHigh.sorted(items, purchases: []).map(\.id) == ["YONEX", "victor", "lining", "亚狮龙", "其他"])
    assert(PegboardSortOrder.priceLow.sorted(items, purchases: []).map(\.id) == ["亚狮龙", "lining", "victor", "YONEX", "其他"])
    assert(PegboardSortOrder.latestPurchase.sorted(items, purchases: []).first?.id == "victor")
    assert(PegboardSortOrder.firstPurchase.sorted(items, purchases: []).first?.id == "lining")
    assert(PegboardSortOrder.automatic.sorted(items, purchases: []) == items)
    assert(PegboardSortOrder.brandRank("rsl") == PegboardSortOrder.brandRank("亚狮龙"))
    print("Gear presentation passed: canonical names, custom-name fallback, brand aliases, prices and purchase order")
  }
}
