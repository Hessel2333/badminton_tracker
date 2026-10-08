import Foundation

@main
struct SpendingLedgerTests {
  static func main() {
    let purchase = PurchaseRecord(id: "p", itemNameSnapshot: "球拍", unitPriceCny: 1000,
      quantity: 1, totalPriceCny: 1000, itemStatus: .inUse, purchaseDate: "2026-01-03T00:00:00Z",
      channel: "拼多多", notes: nil, brand: NamedRef(id: "y", name: "YONEX"),
      category: NamedRef(id: "r", name: "球拍"), gearItem: nil)
    let paid = StringingRecord(stringName: "BG65", stringingDate: "2026-01-05T00:00:00Z", costCny: 60, channel: "PDD")
    let old = StringingRecord(stringName: "BG80", stringingDate: "2025-12-01T00:00:00Z", costCny: 80)
    let undated = StringingRecord(stringName: "BG65", costCny: 50)
    let unknown = StringingRecord(stringingDate: "2026-02-01T00:00:00Z")
    func gear(_ id: String, _ history: [StringingRecord]) -> GearWallItem {
      GearWallItem(id: id, name: "球拍", coverImageUrl: nil, imageKey: nil, modelCode: nil,
        createdAt: nil, latestPurchaseDate: "2026-01-03T00:00:00Z", referenceUnitPriceCny: 1000,
        brand: NamedRef(id: "y", name: "YONEX"), category: NamedRef(id: "r", name: "球拍"),
        profileDetails: .racket(RacketGearDetails(stringHistory: history)), ratings: [],
        totalQuantity: 1, activeQuantity: 1, usedUpQuantity: 0, wornOutQuantity: 0)
    }
    let entries = SpendingLedger.entries(purchases: [purchase], gear: [gear("a", [paid, old, undated, unknown]), gear("b", [paid])])
    assert(entries.count == 5, "Repeated profile history must not double-charge")
    assert(entries.reduce(0) { $0 + ($1.amount ?? 0) } == 1190)
    let year = entries.filter { $0.isInRange("2026") }
    assert(year.count == 3)
    assert(year.reduce(0) { $0 + ($1.amount ?? 0) } == 1060)
    assert(year.filter { $0.matches(.channel("拼多多")) }.count == 2)
    assert(year.filter { $0.matches(.period("2026-01")) }.count == 2)
    assert(year.filter { $0.matches(.purchasePeriod("2026-01")) }.count == 1)
    assert(entries.filter { $0.matches(.stringModel("YONEX BG65")) }.count == 2)
    assert(entries.filter { $0.matches(.stringModel("未记录型号")) }.count == 1)
    let analytics = SpendingLedger.analytics(entries: entries, base: .empty, range: "2026")
    assert(analytics.trend.count == 12)
    assert(analytics.trend.reduce(0) { $0 + $1.amount } == 1060)
    assert(analytics.brandShare.reduce(0) { $0 + $1.amount } == 1060)
    assert(analytics.categoryShare.first { $0.category == "穿线" }?.amount == 60)
    assert(analytics.availableYears == [2026, 2025])
    let all = SpendingLedger.analytics(entries: entries, base: .empty, range: "all")
    assert(all.trend.reduce(0) { $0 + $1.amount } == 1140, "Undated expenses do not invent a date")
    assert(all.categoryShare.reduce(0) { $0 + $1.amount } == 1190)
    for key in Set(entries.map(\.channel)) {
      assert(SpendingLedger.amounts(entries, by: { $0.channel })[key] ==
        entries.filter { $0.matches(.channel(key)) }.reduce(0) { $0 + ($1.amount ?? 0) })
    }
    let deleted = SpendingLedger.entries(purchases: [purchase], gear: [gear("a", [])])
    assert(deleted.count == 1 && deleted.first?.amount == 1000)
    print("Spending ledger passed: deduplication, totals, model/channel drilldown, year/month scope, missing costs/dates and deletion")
  }
}
