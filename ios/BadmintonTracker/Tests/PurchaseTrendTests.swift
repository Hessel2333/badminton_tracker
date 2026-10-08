import Foundation

@main
struct PurchaseTrendTests {
  static func main() {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    func record(_ id: String, _ date: String, quantity: Int = 1, price: Double = 100) -> PurchaseRecord {
      PurchaseRecord(id: id, itemNameSnapshot: "测试装备", unitPriceCny: price,
        quantity: quantity, totalPriceCny: Double(quantity) * price, itemStatus: .inUse,
        purchaseDate: date, channel: nil, notes: nil, brand: nil, category: nil, gearItem: nil)
    }
    let records = [
      record("last", "2026-07-01T00:00:00Z"),
      record("first", "2026-01-01T00:00:00Z", quantity: 1, price: 80),
      record("same-day", "2026-01-01T15:00:00Z", quantity: 3, price: 100),
      record("next-day", "2026-01-02T00:00:00Z"),
      record("invalid", "not-a-date")
    ]
    let series = PurchaseTrendSeries(records: records, calendar: calendar)
    assert(series.points.count == 3)
    assert(series.points[0].quantity == 4)
    assert(series.points[0].price == 95)
    let shortGap = series.points[1].date.timeIntervalSince(series.points[0].date)
    let longGap = series.points[2].date.timeIntervalSince(series.points[1].date)
    assert(shortGap == 86400 && longGap / shortGap == 180)
    assert(series.domain.contains(series.points[0].date) && series.domain.contains(series.points[2].date))
    assert(!series.spansYears)
    assert(series.barWidth(plotWidth: 280) < 2)
    let single = PurchaseTrendSeries(records: [records[0]], calendar: calendar)
    assert(single.domain.lowerBound < single.domain.upperBound)
    assert(single.points.count == 1 && single.barWidth(plotWidth: 280) == 18)
    let unknownPrice = PurchaseTrendSeries(records: [record("missing", "2026-01-01T00:00:00Z", price: 0)], calendar: calendar)
    assert(unknownPrice.points[0].price == nil)
    let crossYear = PurchaseTrendSeries(records: [records[0], record("older", "2025-12-31T00:00:00Z")], calendar: calendar)
    assert(crossYear.spansYears)
    assert(PurchaseTrendSeries(records: [record("bad", "bad")], calendar: calendar).points.isEmpty)
    print("Purchase trend passed: real time spacing, daily weighted price, sorting, invalid dates, single point and cross-year range")
  }
}
