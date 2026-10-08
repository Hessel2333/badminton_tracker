import Foundation

struct LocalGearCatalogEntry: Identifiable, Hashable {
  let catalogEquipmentID: UUID
  let name: String
  let brandName: String
  let modelCode: String?
  let categoryName: String
  let suggestedUnitPriceCny: Double?
  let imageKey: String?
  let popularity: Int
  let tags: [String]

  var id: String { catalogEquipmentID.uuidString }

  init(_ equipment: CatalogEquipment) {
    catalogEquipmentID = equipment.id
    name = GearDisplayName.canonicalName(equipment.name, brand: equipment.brand, model: equipment.model, category: equipment.category.rawValue)
    brandName = equipment.brand
    modelCode = equipment.model
    categoryName = equipment.category.rawValue
    suggestedUnitPriceCny = equipment.suggestedUnitPriceCny
    imageKey = equipment.imageKey
    popularity = equipment.popularity
    tags = equipment.tags
  }

  var searchText: String {
    ([name, brandName, modelCode, categoryName, name.replacingOccurrences(of: "天斧", with: "ASTROX").replacingOccurrences(of: "弓箭", with: "ARCSABER").replacingOccurrences(of: "驭", with: "DriveX")] + tags)
      .compactMap { $0 }
      .joined(separator: " ")
  }

  var subtitle: String {
    [brandName, modelCode, categoryName]
      .compactMap { $0 }
      .filter { !$0.isEmpty }
      .joined(separator: " / ")
  }
}

enum LocalBrandNormalizer {
  static func canonicalName(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }

    let key = normalizedKey(trimmed)
    if ["lining", "liningbadminton", "li-ning", "linning", "李宁"].contains(key) {
      return "李宁"
    }
    if ["yonex", "yy", "尤尼克斯"].contains(key) {
      return "YONEX"
    }
    if ["victor", "胜利", "威克多"].contains(key) {
      return "VICTOR"
    }
    if ["rsl", "亚狮龙", "亞獅龍"].contains(key) {
      return "RSL"
    }
    if ["chao", "chaopai", "超牌"].contains(key) {
      return "超牌"
    }
    if ["weiken", "威肯"].contains(key) {
      return "威肯"
    }
    if ["lingmei", "翎美"].contains(key) {
      return "翎美"
    }
    if ["mizuno", "美津浓", "美津濃"].contains(key) {
      return "Mizuno"
    }
    if ["kawasaki", "川崎"].contains(key) {
      return "Kawasaki"
    }
    if ["kumpoo", "薰风", "薰風"].contains(key) {
      return "Kumpoo"
    }
    if ["bonny", "波力"].contains(key) {
      return "Bonny"
    }

    return trimmed
  }

  private static func normalizedKey(_ value: String) -> String {
    value
      .lowercased()
      .replacingOccurrences(of: "\\s+", with: "", options: .regularExpression)
      .replacingOccurrences(of: "-", with: "")
      .replacingOccurrences(of: "_", with: "")
  }
}

enum LocalGearCatalog {
  /// Bundle decoding is a fallback for previews/tests. Production screens load
  /// the same seed through SwiftData and receive it from the repository.
  static let entries: [LocalGearCatalogEntry] = {
    guard let url = Bundle.main.url(
      forResource: "equipment_catalog",
      withExtension: "json",
      subdirectory: "Seed"
    ), let data = try? Data(contentsOf: url) else {
      return []
    }
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    return ((try? decoder.decode(CatalogSeedFile.self, from: data))?.equipment ?? [])
      .filter(\.isActive)
      .map(LocalGearCatalogEntry.init)
      .sorted { left, right in
    if left.categoryName == right.categoryName {
      return left.popularity > right.popularity
    }
    return left.categoryName < right.categoryName
  }
  }()

  static let purchaseChannels: [String] = [
    "淘宝",
    "京东",
    "拼多多",
    "得物",
    "抖音",
    "小红书",
    "闲鱼",
    "线下",
    "朋友转让"
  ]

  static func brandOptions(categoryName: String?, entries: [LocalGearCatalogEntry] = entries) -> [String] {
    let filtered = entries.filter { entry in
      guard let categoryName, !categoryName.isEmpty, categoryName != "全部" else {
        return true
      }
      return entry.categoryName == categoryName
    }

    return uniqueByPopularity(filtered) { $0.brandName }
  }

  static func modelOptions(
    brandName: String?,
    categoryName: String?,
    entries: [LocalGearCatalogEntry] = entries
  ) -> [LocalGearCatalogEntry] {
    entries.filter { entry in
      let brandMatches: Bool
      if let brandName = LocalBrandNormalizer.canonicalName(brandName) {
        brandMatches = entry.brandName == brandName
      } else {
        brandMatches = true
      }

      let categoryMatches: Bool
      if let categoryName, !categoryName.isEmpty, categoryName != "全部" {
        categoryMatches = entry.categoryName == categoryName
      } else {
        categoryMatches = true
      }

      return brandMatches && categoryMatches
    }
  }

  static func entry(
    matching wishlistItem: WishlistItem,
    entries: [LocalGearCatalogEntry] = entries
  ) -> LocalGearCatalogEntry? {
    let itemName = normalizedLookupKey(wishlistItem.name)
    let itemBrand = LocalBrandNormalizer.canonicalName(wishlistItem.brand?.name)
    let itemCategory = wishlistItem.category?.name

    return entries.first { entry in
      normalizedLookupKey(entry.name) == itemName
        && (itemBrand == nil || entry.brandName == itemBrand)
        && (itemCategory == nil || entry.categoryName == itemCategory)
    }
  }

  static func entry(
    matchingName name: String,
    brandName: String?,
    modelCode: String?,
    categoryName: String?,
    entries: [LocalGearCatalogEntry] = entries
  ) -> LocalGearCatalogEntry? {
    let normalizedName = normalizedLookupKey(GearDisplayName.canonicalName(name, brand: brandName, model: nil, category: categoryName))
    let normalizedBrand = LocalBrandNormalizer.canonicalName(brandName).map(normalizedLookupKey)
    let normalizedModel = modelCode.map(normalizedLookupKey).flatMap { $0.isEmpty ? nil : $0 }
    let normalizedCategory = categoryName.map(normalizedLookupKey).flatMap { $0.isEmpty ? nil : $0 }

    guard !normalizedName.isEmpty || normalizedModel != nil else { return nil }

    let candidates = entries.filter { entry in
      let entryName = normalizedLookupKey(entry.name)
      let entryBrand = normalizedLookupKey(entry.brandName)
      let entryModel = entry.modelCode.map(normalizedLookupKey)
      let entryCategory = normalizedLookupKey(entry.categoryName)
      let brandMatches = normalizedBrand == nil || normalizedBrand == entryBrand
      let categoryMatches = normalizedCategory == nil || normalizedCategory == entryCategory
      let modelMatches = normalizedModel != nil && normalizedModel == entryModel
      let nameMatches = normalizedName == entryName ||
        (!normalizedName.isEmpty && (normalizedName.contains(entryName) || entryName.contains(normalizedName)))

      let productMatches = normalizedModel == nil ? nameMatches : modelMatches
      return brandMatches && categoryMatches && productMatches
    }
    return candidates.first { normalizedLookupKey($0.name) == normalizedName } ?? candidates.first
  }

  static func activeWishlistItem(
    matching entry: LocalGearCatalogEntry,
    in items: [WishlistItem]
  ) -> WishlistItem? {
    let entryName = normalizedLookupKey(entry.name)
    return items.first { item in
      item.status.isActive
        && normalizedLookupKey(item.name) == entryName
        && LocalBrandNormalizer.canonicalName(item.brand?.name) == entry.brandName
        && (item.category?.name == nil || item.category?.name == entry.categoryName)
    }
  }

  private static func uniqueByPopularity(
    _ entries: [LocalGearCatalogEntry],
    value: (LocalGearCatalogEntry) -> String
  ) -> [String] {
    var best: [String: Int] = [:]
    for entry in entries {
      best[value(entry), default: 0] = max(best[value(entry), default: 0], entry.popularity)
    }
    return best
      .sorted { left, right in
        if left.value == right.value {
          return left.key.localizedCompare(right.key) == .orderedAscending
        }
        return left.value > right.value
      }
      .map(\.key)
  }

  private static func normalizedLookupKey(_ value: String) -> String {
    value
      .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
      .replacingOccurrences(of: #"[\s\-_()（）]+"#, with: "", options: .regularExpression)
  }

}

enum LocalGearIdentity {
  static func id(for purchase: PurchaseRecord) -> String {
    id(for: purchase, entries: LocalGearCatalog.entries)
  }

  static func id(for purchase: PurchaseRecord, entries: [LocalGearCatalogEntry]) -> String {
    id(
      name: purchase.itemNameSnapshot,
      brandName: purchase.brand?.name,
      modelCode: purchase.gearItem?.modelCode,
      categoryName: purchase.category?.name,
      entries: entries
    )
  }

  static func id(
    name: String,
    brandName: String?,
    modelCode: String?,
    categoryName: String?,
    entries: [LocalGearCatalogEntry] = LocalGearCatalog.entries
  ) -> String {
    let catalogEntry = LocalGearCatalog.entry(
      matchingName: name,
      brandName: brandName,
      modelCode: modelCode,
      categoryName: categoryName,
      entries: entries
    )
    let resolvedBrand = catalogEntry?.brandName ?? LocalBrandNormalizer.canonicalName(brandName)
    let resolvedCategory = catalogEntry?.categoryName ?? meaningful(categoryName)
    let resolvedModel = meaningful(catalogEntry?.modelCode) ?? meaningful(modelCode)
    let resolvedName = catalogEntry?.name ?? name
    let distinguishingValue = resolvedModel ?? resolvedName
    let slug = [resolvedBrand, resolvedCategory, distinguishingValue]
      .compactMap { $0 }
      .map(normalizedComponent)
      .filter { !$0.isEmpty }
      .joined(separator: "-")

    return "local-gear-\(slug.isEmpty ? "unknown" : slug)"
  }

  private static func meaningful(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  private static func normalizedComponent(_ value: String) -> String {
    value
      .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
      .lowercased()
      .filter { $0.isLetter || $0.isNumber }
  }
}

/// Presentation only: imported snapshots and user data remain untouched.
enum GearDisplayName {
  static func resolve(name: String, brand: String?, model: String?, category: String?, imageKey: String?,
                      entries: [LocalGearCatalogEntry] = LocalGearCatalog.entries) -> String {
    let normalized = canonicalName(name, brand: brand, model: nil, category: category)
    if normalized != name || normalized.hasPrefix("天斧 ") || normalized.hasPrefix("弓箭 ") || normalized.hasPrefix("驭 12") { return normalized }
    if let entry = LocalGearCatalog.entry(matchingName: name, brandName: brand, modelCode: model,
                                         categoryName: category, entries: entries) {
      return canonicalName(entry.name, brand: entry.brandName, model: entry.modelCode, category: entry.categoryName)
    }
    if let imageKey, let entry = entries.first(where: {
      $0.imageKey == imageKey && (brand == nil || LocalBrandNormalizer.canonicalName(brand) == $0.brandName)
        && (category == nil || category == $0.categoryName)
    }) {
      return canonicalName(entry.name, brand: entry.brandName, model: entry.modelCode, category: entry.categoryName)
    }
    return canonicalName(name, brand: brand, model: model, category: category)
  }

  /// One presentation rule for both persisted catalogs and imported snapshots.
  /// Only recognized racket series are translated; custom names remain intact.
  static func canonicalName(_ name: String, brand: String?, model: String?, category: String?) -> String {
    guard category == nil || category == "球拍" else { return name }
    let canonicalBrand = LocalBrandNormalizer.canonicalName(brand)
    if canonicalBrand == nil || canonicalBrand == "VICTOR" {
      if let victorName = victorDriveXName(name) ?? model.flatMap(victorDriveXName) { return victorName }
    }
    guard canonicalBrand == nil || canonicalBrand == "YONEX" else { return name }
    func parse(_ value: String, allowBareModel: Bool) -> String? {
      var key = value.uppercased().replacingOccurrences(of: "YONEX", with: "")
        .replacingOccurrences(of: "尤尼克斯", with: "")
        .replacingOccurrences(of: "\\s+", with: "", options: .regularExpression)
      key = key.replacingOccurrences(of: "（", with: "(").replacingOccurrences(of: "）", with: ")")
      let series: [(String, String)] = [("ARCSABER", "弓箭"), ("ASTROX", "天斧"),
        ("弓箭", "弓箭"), ("天斧", "天斧"), ("ARC", "弓箭"), ("AX", "天斧"), ("弓", "弓箭")]
      var label: String?
      for (prefix, title) in series where key.hasPrefix(prefix) {
        label = title
        key.removeFirst(prefix.count)
        break
      }
      if label == nil && allowBareModel {
        if key.range(of: "^(77|88D|88S|99|100)(PRO|TOUR|PLAY|GAME|ZZ|ZX|Z)?(?:\\([^()]+\\))?$", options: .regularExpression) != nil { label = "天斧" }
        else if key.range(of: "^(7|11)(PRO|TOUR|PLAY)?$", options: .regularExpression) != nil { label = "弓箭" }
      }
      guard let label,
            key.range(of: "^[0-9]+[A-Z]*(?:-[0-9]+)?(?:\\([^()]+\\))?$", options: .regularExpression) != nil else { return nil }
      for suffix in ["PRO", "TOUR", "PLAY", "GAME"] {
        key = key.replacingOccurrences(of: suffix, with: " " + suffix.capitalized)
      }
      key = key.replacingOccurrences(of: "(", with: " (")
      return label + " " + key
    }
    // Prefer the name to retain explicit color/generation qualifiers.
    return parse(name, allowBareModel: brand != nil)
      ?? model.flatMap { parse($0, allowBareModel: brand != nil) }
      ?? name
  }

  private static func victorDriveXName(_ value: String) -> String? {
    let value = value.trimmingCharacters(in: .whitespacesAndNewlines)
      .replacingOccurrences(of: "（", with: "(").replacingOccurrences(of: "）", with: ")")
    // Keep edition text intact; only the known model and ZSW J alias are normalized.
    let pattern = #"^(?:(?:VICTOR|胜利|威克多)\s*)?(?:DRIVE\s*X|DX|驭)\s*-?\s*12(?:\s*\(([^()]+)\)|\s+(ZSW\s*J))?$"#
    guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
          let match = regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) else { return nil }
    let edition = [1, 2].compactMap { Range(match.range(at: $0), in: value).map { String(value[$0]) } }.first
    guard var edition else { return "驭 12" }
    edition = edition.trimmingCharacters(in: .whitespacesAndNewlines)
    if edition.uppercased().filter({ !$0.isWhitespace }) == "ZSWJ" { edition = "ZSW J" }
    return "驭 12 (\(edition))"
  }

}

extension PurchaseRecord {
  var displayName: String {
    GearDisplayName.resolve(name: itemNameSnapshot, brand: brand?.name, model: gearItem?.modelCode,
      category: category?.name, imageKey: gearItem?.imageKey)
  }
}

extension GearWallItem {
  var displayName: String {
    GearDisplayName.resolve(name: name, brand: brand?.name, model: modelCode,
      category: category?.name, imageKey: imageKey)
  }
}

enum PegboardSortOrder: String, CaseIterable, Identifiable {
  case automatic, brand, priceHigh, priceLow, latestPurchase, firstPurchase
  var id: String { rawValue }
  var label: String {
    switch self {
    case .automatic: "默认排列"
    case .brand: "按品牌"
    case .priceHigh: "价格从高到低"
    case .priceLow: "价格从低到高"
    case .latestPurchase: "最近购买优先"
    case .firstPurchase: "最早购买优先"
    }
  }

  static func brandRank(_ brand: String?) -> Int {
    switch LocalBrandNormalizer.canonicalName(brand) {
    case "YONEX": 0
    case "RSL": 1
    case "VICTOR": 2
    case "李宁": 3
    default: 4
    }
  }

  func sorted(_ items: [GearWallItem], purchases: [PurchaseRecord]) -> [GearWallItem] {
    guard self != .automatic else { return items }
    let firstDates = Dictionary(grouping: purchases, by: LocalGearIdentity.id(for:)).mapValues {
      $0.compactMap { AppDate.parseISODate($0.purchaseDate) }.min()
    }
    return items.sorted { left, right in
      switch self {
      case .automatic: break
      case .brand:
        let l = Self.brandRank(left.brand?.name), r = Self.brandRank(right.brand?.name)
        if l != r { return l < r }
        let lb = LocalBrandNormalizer.canonicalName(left.brand?.name) ?? ""
        let rb = LocalBrandNormalizer.canonicalName(right.brand?.name) ?? ""
        if lb != rb { return lb.localizedStandardCompare(rb) == .orderedAscending }
      case .priceHigh, .priceLow:
        let l = left.referenceUnitPriceCny, r = right.referenceUnitPriceCny
        if l != r {
          guard let l else { return false }
          guard let r else { return true }
          return self == .priceHigh ? l > r : l < r
        }
      case .latestPurchase, .firstPurchase:
        let l = self == .latestPurchase ? AppDate.parseISODate(left.latestPurchaseDate)
          : (firstDates[left.id] ?? nil) ?? AppDate.parseISODate(left.createdAt) ?? AppDate.parseISODate(left.latestPurchaseDate)
        let r = self == .latestPurchase ? AppDate.parseISODate(right.latestPurchaseDate)
          : (firstDates[right.id] ?? nil) ?? AppDate.parseISODate(right.createdAt) ?? AppDate.parseISODate(right.latestPurchaseDate)
        if l != r {
          guard let l else { return false }
          guard let r else { return true }
          return self == .latestPurchase ? l > r : l < r
        }
      }
      if left.displayName != right.displayName {
        return left.displayName.localizedStandardCompare(right.displayName) == .orderedAscending
      }
      return left.id < right.id
    }
  }
}

struct SpendingEntry: Identifiable {
  let id: String
  let title: String
  let date: String?
  let amount: Double?
  let brand: String
  let category: String
  let channel: String
  let purchase: PurchaseRecord?
  let stringing: StringingRecord?
  let gearName: String?
  var stringModel: String? { stringing.map { RacketStringOptions.normalizedStringName($0.stringName) ?? "未记录型号" } }
  var dateLabel: String { date ?? "" }
  func isInRange(_ range: String) -> Bool { range == "all" || (date?.hasPrefix(range) ?? false) }

  func matches(_ dimension: AnalyticsPurchaseDimension) -> Bool {
    switch dimension {
    case .channel(let value): channel == value
    case .brand(let value): brand == value
    case .category(let value): category == value
    case .period(let value): date.map { String($0.prefix(value.count)) == value } ?? false
    case .purchasePeriod(let value): purchase != nil && (date.map { String($0.prefix(value.count)) == value } ?? false)
    case .stringModel(let value): stringModel == value
    }
  }
}

enum SpendingLedger {
  static func entries(purchases: [PurchaseRecord], gear: [GearWallItem]) -> [SpendingEntry] {
    var result = purchases.map { record in
      SpendingEntry(id: "purchase:\(record.id)", title: record.displayName, date: record.purchaseDate,
        amount: record.totalPriceCny, brand: record.analyticsBrandName, category: record.analyticsCategoryName,
        channel: record.normalizedChannelName, purchase: record, stringing: nil, gearName: nil)
    }
    var seen = Set<UUID>()
    for item in gear.sorted(by: { ($0.latestPurchaseDate ?? "") > ($1.latestPurchaseDate ?? "") }) {
      guard case .racket(let details) = item.profileDetails else { continue }
      for record in details.stringHistory where seen.insert(record.id).inserted {
        let model = RacketStringOptions.normalizedStringName(record.stringName) ?? "未记录型号"
        let date = AppDate.parseISODate(record.stringingDate) == nil ? nil : record.stringingDate
        result.append(SpendingEntry(id: "stringing:\(record.id.uuidString)", title: model, date: date,
          amount: record.costCny.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil },
          brand: item.brand?.name ?? "未标记品牌", category: "穿线", channel: record.normalizedChannel,
          purchase: nil, stringing: record, gearName: item.displayName))
      }
    }
    return result.sorted { left, right in
      if left.dateLabel == right.dateLabel { return left.id < right.id }
      return left.dateLabel > right.dateLabel
    }
  }

  static func amounts(_ entries: [SpendingEntry], by key: (SpendingEntry) -> String) -> [String: Double] {
    entries.reduce(into: [:]) { result, entry in result[key(entry), default: 0] += entry.amount ?? 0 }
  }

  static func analytics(entries: [SpendingEntry], base: AnalyticsData, range: String) -> AnalyticsData {
    var result = base
    let selected = entries.filter { $0.isInRange(range) }
    let years = Set(entries.compactMap { entry -> Int? in
      guard let date = entry.date, AppDate.parseISODate(date) != nil else { return nil }
      return Int(date.prefix(4))
    })
    result.availableYears = years.sorted(by: >)
    let buckets: [String]
    if range == "all", let first = years.min(), let last = years.max() {
      let current = Calendar.current.component(.year, from: Date())
      buckets = (first...max(last, current)).map(String.init)
    } else if range != "all" {
      buckets = (1...12).map { String(format: "%@-%02d", range, $0) }
    } else { buckets = [] }
    let dated = selected.filter { $0.date != nil }
    let amountsByDate = amounts(dated) { String($0.dateLabel.prefix(range == "all" ? 4 : 7)) }
    result.trend = buckets.map { TrendPoint(bucket: $0, amount: amountsByDate[$0] ?? 0) }
    result.brandShare = amounts(selected, by: { $0.brand }).map { BrandShare(brand: $0.key, amount: $0.value) }
      .sorted { $0.amount == $1.amount ? $0.brand < $1.brand : $0.amount > $1.amount }
    result.categoryShare = amounts(selected, by: { $0.category }).map { CategoryShare(category: $0.key, amount: $0.value) }
      .sorted { $0.amount == $1.amount ? $0.category < $1.category : $0.amount > $1.amount }
    // Purchase frequency retains its original meaning; stringing count has a separate chart.
    return result
  }
}
