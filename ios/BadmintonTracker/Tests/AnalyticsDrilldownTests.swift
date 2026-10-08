import Foundation

@main
struct AnalyticsDrilldownTests {
  static func main() {
    func record(_ id: String, date: String, channel: String?, amount: Double,
                brand: String? = "YONEX", category: String? = "羽毛球") -> PurchaseRecord {
      PurchaseRecord(id: id, itemNameSnapshot: "同一装备", unitPriceCny: amount / 2,
        quantity: 2, totalPriceCny: amount, itemStatus: .inUse, purchaseDate: date,
        channel: channel, notes: nil, brand: brand.map { NamedRef(id: $0, name: $0) },
        category: category.map { NamedRef(id: $0, name: $0) }, gearItem: nil)
    }
    let purchases = [
      record("old", date: "2025-10-01T00:00:00Z", channel: "拼多多", amount: 200),
      record("alias", date: "2026-01-03T00:00:00Z", channel: " PDD ", amount: 120),
      record("new", date: "2026-10-08T00:00:00Z", channel: "拼多多", amount: 80),
      record("other", date: "2026-10-01T00:00:00Z", channel: "京东", amount: 50, brand: "VICTOR", category: "球拍"),
      record("unknown", date: "2026-10-02T00:00:00Z", channel: nil, amount: 0, brand: nil, category: nil)
    ]
    func records(_ dimension: AnalyticsPurchaseDimension, range: String = "2026") -> [PurchaseRecord] {
      AnalyticsPurchaseFilter(range: range, dimension: dimension).records(in: purchases)
    }
    assert(records(.channel("拼多多")).map(\.id) == ["new", "alias"])
    assert(records(.channel("拼多多")).reduce(0) { $0 + $1.totalPriceCny } == 200)
    assert(records(.channel("拼多多"), range: "all").count == 3)
    assert(records(.channel("未记录")).map(\.id) == ["unknown"])
    assert(records(.brand("未标记品牌")).map(\.id) == ["unknown"])
    assert(records(.category("其他")).map(\.id) == ["unknown"])
    assert(records(.period("2026-10")).count == 3)
    assert(records(.period("2026-02")).isEmpty)
    assert(records(.period("2025"), range: "all").map(\.id) == ["old"])
    assert(records(.period("2025")).isEmpty)
    // Reconcile every grouping against the chart's complete source population.
    let scoped = AnalyticsPurchaseFilter.inRange(purchases, range: "2026")
    for key in Set(scoped.map(\.analyticsBrandName)) {
      assert(records(.brand(key)).reduce(0) { $0 + $1.totalPriceCny } ==
        scoped.filter { $0.analyticsBrandName == key }.reduce(0) { $0 + $1.totalPriceCny })
    }
    let amounts = [20.0, 0, 30, 50]
    assert(AnalyticsPurchaseFilter.sectorIndex(value: 0, amounts: amounts) == 0)
    assert(AnalyticsPurchaseFilter.sectorIndex(value: 19.99, amounts: amounts) == 0)
    assert(AnalyticsPurchaseFilter.sectorIndex(value: 20, amounts: amounts) == 2)
    assert(AnalyticsPurchaseFilter.sectorIndex(value: 50, amounts: amounts) == 3)
    assert(AnalyticsPurchaseFilter.sectorIndex(value: 100, amounts: amounts) == nil)
    assert(AnalyticsPurchaseFilter.sectorIndex(value: .nan, amounts: amounts) == nil)
    assert(AnalyticsPurchaseFilter.sectorIndex(value: -1, amounts: amounts) == nil)
    print("Analytics drilldown passed: year/month scope, channel aliases, grouping totals, repeated purchases, empty groups and sector boundaries")
  }
}
