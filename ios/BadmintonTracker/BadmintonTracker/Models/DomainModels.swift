import Foundation

enum AppDate {
  private static let fractionalStyle = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
  private static let standardStyle = Date.ISO8601FormatStyle(includingFractionalSeconds: false)
  nonisolated(unsafe) private static let parsedDates: NSCache<NSString, NSDate> = {
    let cache = NSCache<NSString, NSDate>()
    cache.countLimit = 2000
    return cache
  }()

  static func parseISODate(_ rawValue: String?) -> Date? {
    guard let rawValue, !rawValue.isEmpty else { return nil }
    if let cached = parsedDates.object(forKey: rawValue as NSString) { return cached as Date }
    guard let date = (try? fractionalStyle.parse(rawValue)) ?? (try? standardStyle.parse(rawValue)) else { return nil }
    parsedDates.setObject(date as NSDate, forKey: rawValue as NSString)
    return date
  }
}

struct NamedRef: Codable, Identifiable, Hashable {
  let id: String?
  let name: String
}

enum ItemStatus: String, Codable, CaseIterable, Identifiable {
  case inUse = "IN_USE"
  case usedUp = "USED_UP"
  case wornOut = "WORN_OUT"
  case stored = "STORED"

  var id: String { rawValue }

  var label: String {
    switch self {
    case .inUse: "在用"
    case .usedUp: "已用完"
    case .wornOut: "已退役"
    case .stored: "闲置"
    }
  }
}

enum WishlistStatus: String, Codable, CaseIterable, Identifiable {
  case want = "WANT"
  case watching = "WATCHING"
  case purchased = "PURCHASED"
  case dropped = "DROPPED"

  var id: String { rawValue }

  var label: String {
    switch self {
    case .want: "想买"
    case .watching: "观望"
    case .purchased: "已入手"
    case .dropped: "已放弃"
    }
  }

  var isActive: Bool {
    self == .want || self == .watching
  }
}

struct ConsumptionRecord: Codable, Identifiable, Hashable {
  var id: String = UUID().uuidString
  var quantity: Int
  var finishedDate: String?
  var startedDate: String? = nil

  var usageDays: Int? {
    guard let start = AppDate.parseISODate(startedDate),
          let end = AppDate.parseISODate(finishedDate), end >= start else { return nil }
    return Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: start),
      to: Calendar.current.startOfDay(for: end)).day
  }
}

struct PurchaseRecord: Codable, Identifiable, Hashable {
  let id: String
  let itemNameSnapshot: String
  let unitPriceCny: Double
  let quantity: Int
  let totalPriceCny: Double
  let itemStatus: ItemStatus
  let purchaseDate: String
  let statusDate: String?
  let consumptionRecords: [ConsumptionRecord]
  let channel: String?
  let notes: String?
  let brand: NamedRef?
  let category: NamedRef?
  let gearItem: GearSummary?

  enum CodingKeys: String, CodingKey {
    case id
    case itemNameSnapshot
    case unitPriceCny
    case quantity
    case totalPriceCny
    case itemStatus
    case purchaseDate
    case statusDate
    case consumptionRecords
    case channel
    case notes
    case brand
    case category
    case gearItem
  }

  init(
    id: String,
    itemNameSnapshot: String,
    unitPriceCny: Double,
    quantity: Int,
    totalPriceCny: Double,
    itemStatus: ItemStatus,
    purchaseDate: String,
    statusDate: String? = nil,
    consumptionRecords: [ConsumptionRecord] = [],
    channel: String?,
    notes: String?,
    brand: NamedRef?,
    category: NamedRef?,
    gearItem: GearSummary?
  ) {
    self.id = id
    self.itemNameSnapshot = itemNameSnapshot
    self.unitPriceCny = unitPriceCny
    self.quantity = quantity
    self.totalPriceCny = totalPriceCny
    self.itemStatus = itemStatus
    self.purchaseDate = purchaseDate
    self.statusDate = statusDate
    self.consumptionRecords = consumptionRecords
    self.channel = channel
    self.notes = notes
    self.brand = brand
    self.category = category
    self.gearItem = gearItem
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    itemNameSnapshot = try container.decode(String.self, forKey: .itemNameSnapshot)
    unitPriceCny = try container.decodeFlexibleDouble(forKey: .unitPriceCny)
    quantity = try container.decodeIfPresent(Int.self, forKey: .quantity) ?? 1
    totalPriceCny = try container.decodeFlexibleDouble(forKey: .totalPriceCny)
    itemStatus = try container.decodeIfPresent(ItemStatus.self, forKey: .itemStatus) ?? .inUse
    purchaseDate = try container.decode(String.self, forKey: .purchaseDate)
    statusDate = try container.decodeIfPresent(String.self, forKey: .statusDate)
    consumptionRecords = try container.decodeIfPresent([ConsumptionRecord].self, forKey: .consumptionRecords) ?? []
    channel = try container.decodeIfPresent(String.self, forKey: .channel)
    notes = try container.decodeIfPresent(String.self, forKey: .notes)
    brand = try container.decodeIfPresent(NamedRef.self, forKey: .brand)
    category = try container.decodeIfPresent(NamedRef.self, forKey: .category)
    gearItem = try container.decodeIfPresent(GearSummary.self, forKey: .gearItem)
  }
}

extension PurchaseRecord {
  var consumptionHistory: [ConsumptionRecord] {
    if consumptionRecords.isEmpty && itemStatus == .usedUp {
      return [ConsumptionRecord(id: "legacy-\(id)", quantity: quantity, finishedDate: statusDate)]
    }
    return consumptionRecords
  }

  var consumedQuantity: Int { min(quantity, consumptionHistory.reduce(0) { $0 + $1.quantity }) }
  var remainingQuantity: Int { max(0, quantity - consumedQuantity) }
  var inventoryStatusText: String {
    if consumedQuantity == quantity { return "已用完" }
    if consumedQuantity > 0 { return "已用完 \(consumedQuantity) · 剩余 \(remainingQuantity)" }
    return itemStatus.label
  }

  var effectiveUnitPriceCny: Double? {
    if unitPriceCny > 0 {
      return unitPriceCny
    }
    guard quantity > 0, totalPriceCny > 0 else {
      return nil
    }
    return totalPriceCny / Double(quantity)
  }

  var normalizedChannelName: String {
    PurchaseChannelOptions.normalizedChannel(channel) ?? "未记录"
  }
}

struct PurchaseInput: Encodable {
  var catalogEquipmentID: UUID? = nil
  var brandName: String?
  var modelCode: String?
  var categoryId: String?
  var categoryName: String?
  var gearCoverImageUrl: String?
  var gearImageKey: String? = nil
  var profileDetails: GearProfileDetails? = nil
  var itemNameSnapshot: String
  var unitPriceCny: Double
  var quantity: Int
  var totalPriceCny: Double?
  var purchaseDate: String
  var channel: String?
  var itemStatus: ItemStatus
  var allowAutoImageLookup = true
  var isSecondHand = false
  var notes: String?
  var receiptImageUrl: String?
}

struct GearEditInput {
  var name: String
  var brandName: String?
  var modelCode: String?
  var categoryName: String
  var gearCoverImageUrl: String?
  var profileDetails: GearProfileDetails?
}

struct PurchaseEditInput {
  var consumptionRecords: [ConsumptionRecord]? = nil
  var unitPriceCny: Double
  var quantity: Int
  var purchaseDate: String
  var statusDate: String?
  var channel: String?
  var itemStatus: ItemStatus
  var notes: String?
}

struct PurchasePage: Decodable {
  let page: Int
  let pageSize: Int
  let total: Int?
  let items: [PurchaseRecord]
}

struct GearSummary: Codable, Hashable {
  let id: String?
  let catalogEquipmentID: UUID?
  let modelCode: String?
  let coverImageUrl: String?
  let imageKey: String?
  let profileDetails: GearProfileDetails?

  enum CodingKeys: String, CodingKey {
    case id
    case catalogEquipmentID
    case modelCode
    case coverImageUrl
    case imageKey
    case profileDetails
  }

  init(
    id: String?,
    catalogEquipmentID: UUID? = nil,
    modelCode: String?,
    coverImageUrl: String?,
    imageKey: String?,
    profileDetails: GearProfileDetails? = nil
  ) {
    self.id = id
    self.catalogEquipmentID = catalogEquipmentID
    self.modelCode = modelCode
    self.coverImageUrl = coverImageUrl
    self.imageKey = imageKey
    self.profileDetails = profileDetails
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decodeIfPresent(String.self, forKey: .id)
    catalogEquipmentID = try container.decodeIfPresent(UUID.self, forKey: .catalogEquipmentID)
    modelCode = try container.decodeIfPresent(String.self, forKey: .modelCode)
    coverImageUrl = try container.decodeIfPresent(String.self, forKey: .coverImageUrl)
    imageKey = try container.decodeIfPresent(String.self, forKey: .imageKey)
    profileDetails = try container.decodeIfPresent(GearProfileDetails.self, forKey: .profileDetails)
  }
}

enum GearProfileDetails: Codable, Hashable {
  case shuttle(ShuttleGearDetails)
  case racket(RacketGearDetails)
  case shoes(ShoesGearDetails)
  case other(OtherGearDetails)

  enum CodingKeys: String, CodingKey {
    case type
    case shuttle
    case racket
    case shoes
    case other
  }

  enum ProfileType: String, Codable {
    case shuttle
    case racket
    case shoes
    case other
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let type = try container.decode(ProfileType.self, forKey: .type)
    switch type {
    case .shuttle:
      self = .shuttle(try container.decode(ShuttleGearDetails.self, forKey: .shuttle))
    case .racket:
      self = .racket(try container.decode(RacketGearDetails.self, forKey: .racket))
    case .shoes:
      self = .shoes(try container.decode(ShoesGearDetails.self, forKey: .shoes))
    case .other:
      self = .other(try container.decode(OtherGearDetails.self, forKey: .other))
    }
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    switch self {
    case .shuttle(let details):
      try container.encode(ProfileType.shuttle, forKey: .type)
      try container.encode(details, forKey: .shuttle)
    case .racket(let details):
      try container.encode(ProfileType.racket, forKey: .type)
      try container.encode(details, forKey: .racket)
    case .shoes(let details):
      try container.encode(ProfileType.shoes, forKey: .type)
      try container.encode(details, forKey: .shoes)
    case .other(let details):
      try container.encode(ProfileType.other, forKey: .type)
      try container.encode(details, forKey: .other)
    }
  }
}

struct ShuttleGearDetails: Codable, Hashable {
  var ballsPerTube: Int?
  var speed: String?
}

struct RacketGearDetails: Codable, Hashable {
  var weightSpec: String?
  var gripSpec: String?
  var currentString: String?
  var mainTension: Double?
  var crossTension: Double?
  var stringingDate: String?
  var stringHistory: [StringingRecord]

  init(
    weightSpec: String? = nil,
    gripSpec: String? = nil,
    currentString: String? = nil,
    mainTension: Double? = nil,
    crossTension: Double? = nil,
    stringingDate: String? = nil,
    stringHistory: [StringingRecord] = []
  ) {
    self.weightSpec = weightSpec
    self.gripSpec = gripSpec
    self.currentString = currentString
    self.mainTension = mainTension
    self.crossTension = crossTension
    self.stringingDate = stringingDate
    self.stringHistory = stringHistory
  }
}

extension RacketGearDetails {
  func refreshedFromStoredHistory() -> RacketGearDetails {
    refreshingCurrentStringingFromHistory()
  }

  func appendingStringingRecord(_ record: StringingRecord) -> RacketGearDetails {
    var updatedRecord = record
    updatedRecord.stringName = RacketStringOptions.normalizedStringName(record.stringName)
    var details = self
    details.stringHistory.append(updatedRecord)
    return details.refreshingCurrentStringingFromHistory()
  }

  func replacingStringingRecord(_ record: StringingRecord) -> RacketGearDetails {
    var updatedRecord = record
    updatedRecord.stringName = RacketStringOptions.normalizedStringName(record.stringName)
    var details = self
    if let index = details.stringHistory.firstIndex(where: { $0.id == record.id }) {
      details.stringHistory[index] = updatedRecord
    } else {
      details.stringHistory.append(updatedRecord)
    }
    return details.refreshingCurrentStringingFromHistory()
  }

  func removingStringingRecord(id: UUID) -> RacketGearDetails {
    var details = self
    details.stringHistory.removeAll { $0.id == id }
    return details.refreshingCurrentStringingFromHistory()
  }

  private func refreshingCurrentStringingFromHistory() -> RacketGearDetails {
    var details = self
    guard let latest = details.stringHistory.max(by: {
      stringingSortDate($0) < stringingSortDate($1)
    }) else {
      details.currentString = nil
      details.mainTension = nil
      details.crossTension = nil
      details.stringingDate = nil
      return details
    }

    details.currentString = latest.stringName
    details.mainTension = latest.mainTension
    details.crossTension = latest.crossTension
    details.stringingDate = latest.stringingDate
    return details
  }

  private func stringingSortDate(_ record: StringingRecord) -> Date {
    AppDate.parseISODate(record.stringingDate) ?? .distantPast
  }
}

enum RacketSpecOptions {
  static let weightSpecs = ["2U", "3U", "4U", "5U", "6U"]
  static let gripSpecs = ["G4", "G5", "G6"]

  static func normalizedWeightSpec(_ value: String?) -> String {
    normalized(value, options: weightSpecs, fallback: "4U")
  }

  static func normalizedGripSpec(_ value: String?) -> String {
    normalized(value, options: gripSpecs, fallback: "G5")
  }

  private static func normalized(_ value: String?, options: [String], fallback: String) -> String {
    guard let value else { return fallback }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    return options.first { $0.uppercased() == trimmed } ?? fallback
  }
}

enum RacketStringOptions {
  static let popularStrings = [
    "YONEX BG65",
    "YONEX BG65Ti",
    "YONEX BG66 Ultimax",
    "YONEX BG80",
    "YONEX BG80 Power",
    "YONEX Aerobite",
    "YONEX EXBOLT 63",
    "YONEX EXBOLT 65",
    "YONEX EXBOLT 68",
    "VICTOR VBS-63",
    "VICTOR VBS-66 Nano",
    "VICTOR VBS-68 Power",
    "李宁 1号线",
    "李宁 5号线",
    "李宁 7号线"
  ]

  static func normalizedStringName(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    let key = normalizedKey(trimmed)
    return popularStrings.first { normalizedKey($0) == key } ?? trimmed
  }

  static func isPopularString(_ value: String?) -> Bool {
    guard let value else { return false }
    let key = normalizedKey(value)
    return popularStrings.contains { normalizedKey($0) == key }
  }

  private static func normalizedKey(_ value: String) -> String {
    value
      .lowercased()
      .replacingOccurrences(of: "\\s+", with: "", options: .regularExpression)
      .replacingOccurrences(of: "-", with: "")
      .replacingOccurrences(of: "_", with: "")
      .replacingOccurrences(of: "yonex", with: "")
      .replacingOccurrences(of: "尤尼克斯", with: "")
      .replacingOccurrences(of: "victor", with: "")
      .replacingOccurrences(of: "胜利", with: "")
      .replacingOccurrences(of: "李宁", with: "lining")
  }
}

enum PurchaseChannelOptions {
  static let presets = ["淘宝", "京东", "拼多多", "得物", "抖音", "小红书", "闲鱼", "线下", "朋友转让"]

  static func normalizedPreset(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    let key = normalizedKey(trimmed)
    if key == normalizedKey("初始导入") {
      return nil
    }
    if ["线下门店", "球馆店", "俱乐部团购", "门店", "实体店", "线下店"].contains(where: { normalizedKey($0) == key }) {
      return "线下"
    }
    if ["pdd", "拼多多"].contains(where: { normalizedKey($0) == key }) {
      return "拼多多"
    }
    return presets.first { normalizedKey($0) == key }
  }

  static func normalizedChannel(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    return normalizedPreset(trimmed) ?? trimmed
  }

  static func isPreset(_ value: String?) -> Bool {
    normalizedPreset(value) != nil
  }

  private static func normalizedKey(_ value: String) -> String {
    value
      .lowercased()
      .replacingOccurrences(of: "\\s+", with: "", options: .regularExpression)
      .replacingOccurrences(of: "-", with: "")
      .replacingOccurrences(of: "_", with: "")
  }
}

struct StringingRecord: Codable, Identifiable, Hashable {
  var id: UUID
  var stringName: String?
  var mainTension: Double?
  var crossTension: Double?
  var stringingDate: String?
  var costCny: Double? = nil
  var channel: String? = nil
  var notes: String?

  var normalizedChannel: String {
    PurchaseChannelOptions.normalizedChannel(channel) ?? "未记录"
  }

  init(
    id: UUID = UUID(),
    stringName: String? = nil,
    mainTension: Double? = nil,
    crossTension: Double? = nil,
    stringingDate: String? = nil,
    costCny: Double? = nil,
    channel: String? = nil,
    notes: String? = nil
  ) {
    self.id = id
    self.stringName = stringName
    self.mainTension = mainTension
    self.crossTension = crossTension
    self.stringingDate = stringingDate
    self.costCny = costCny
    self.channel = channel
    self.notes = notes
  }

  private enum CodingKeys: String, CodingKey {
    case id
    case stringName
    case mainTension
    case crossTension
    case stringingDate
    case costCny
    case channel
    case notes
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    if let uuid = try? container.decode(UUID.self, forKey: .id) {
      id = uuid
    } else if let legacyID = try? container.decode(String.self, forKey: .id) {
      id = StableUUID.from(legacyID)
    } else {
      id = UUID()
    }
    stringName = try container.decodeIfPresent(String.self, forKey: .stringName)
    mainTension = try container.decodeIfPresent(Double.self, forKey: .mainTension)
    crossTension = try container.decodeIfPresent(Double.self, forKey: .crossTension)
    stringingDate = try container.decodeIfPresent(String.self, forKey: .stringingDate)
    costCny = try container.decodeIfPresent(Double.self, forKey: .costCny)
    channel = try container.decodeIfPresent(String.self, forKey: .channel)
    notes = try container.decodeIfPresent(String.self, forKey: .notes)
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(id, forKey: .id)
    try container.encodeIfPresent(stringName, forKey: .stringName)
    try container.encodeIfPresent(mainTension, forKey: .mainTension)
    try container.encodeIfPresent(crossTension, forKey: .crossTension)
    try container.encodeIfPresent(stringingDate, forKey: .stringingDate)
    try container.encodeIfPresent(costCny, forKey: .costCny)
    try container.encodeIfPresent(channel, forKey: .channel)
    try container.encodeIfPresent(notes, forKey: .notes)
  }
}

struct ShoesGearDetails: Codable, Hashable {
  var size: String?
  var sizeSystem: String?
  var colorway: String?
}

struct OtherGearDetails: Codable, Hashable {
  var note: String?
}

struct GearItem: Decodable, Identifiable, Hashable {
  let id: String
  let name: String
  let modelCode: String?
  let coverImageUrl: String?
  let imageKey: String?
  let notes: String?
  let brand: NamedRef?
  let category: NamedRef?
  let ratings: [GearRating]?
}

struct GearRating: Decodable, Hashable {
  let overall: Double?

  enum CodingKeys: String, CodingKey {
    case overall
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    overall = try container.decodeFlexibleDoubleIfPresent(forKey: .overall)
  }

  init(overall: Double?) {
    self.overall = overall
  }
}

struct GearResponse: Decodable {
  let items: [GearItem]
}

extension PurchaseRecord {
  func repeatPurchaseInput(on date: Date = Date()) -> PurchaseInput {
    PurchaseInput(catalogEquipmentID: gearItem?.catalogEquipmentID,
      brandName: brand?.name, modelCode: gearItem?.modelCode,
      categoryName: category?.name, gearCoverImageUrl: gearItem?.coverImageUrl,
      gearImageKey: gearItem?.imageKey, profileDetails: gearItem?.profileDetails,
      itemNameSnapshot: itemNameSnapshot, unitPriceCny: unitPriceCny, quantity: 1,
      totalPriceCny: unitPriceCny, purchaseDate: ISO8601DateFormatter().string(from: date),
      channel: channel, itemStatus: .inUse)
  }
}

struct GearWallItem: Decodable, Identifiable, Hashable {
  var stockQuantity: Int { max(0, totalQuantity - usedUpQuantity - wornOutQuantity) }
  var isLowOnShuttles: Bool { category?.name == "羽毛球" && stockQuantity == 1 }
  let id: String
  let name: String
  let coverImageUrl: String?
  let imageKey: String?
  let modelCode: String?
  let createdAt: String?
  let latestPurchaseDate: String?
  let referenceUnitPriceCny: Double?
  let brand: NamedRef?
  let category: NamedRef?
  let profileDetails: GearProfileDetails?
  let ratings: [GearRating]
  let totalQuantity: Int
  let activeQuantity: Int
  let usedUpQuantity: Int
  let wornOutQuantity: Int

  enum CodingKeys: String, CodingKey {
    case id
    case name
    case coverImageUrl
    case imageKey
    case modelCode
    case createdAt
    case latestPurchaseDate
    case referenceUnitPriceCny
    case brand
    case category
    case profileDetails
    case ratings
    case totalQuantity
    case activeQuantity
    case usedUpQuantity
    case wornOutQuantity
  }

  init(
    id: String,
    name: String,
    coverImageUrl: String?,
    imageKey: String?,
    modelCode: String?,
    createdAt: String?,
    latestPurchaseDate: String?,
    referenceUnitPriceCny: Double?,
    brand: NamedRef?,
    category: NamedRef?,
    profileDetails: GearProfileDetails?,
    ratings: [GearRating],
    totalQuantity: Int,
    activeQuantity: Int,
    usedUpQuantity: Int,
    wornOutQuantity: Int
  ) {
    self.id = id
    self.name = name
    self.coverImageUrl = coverImageUrl
    self.imageKey = imageKey
    self.modelCode = modelCode
    self.createdAt = createdAt
    self.latestPurchaseDate = latestPurchaseDate
    self.referenceUnitPriceCny = referenceUnitPriceCny
    self.brand = brand
    self.category = category
    self.profileDetails = profileDetails
    self.ratings = ratings
    self.totalQuantity = totalQuantity
    self.activeQuantity = activeQuantity
    self.usedUpQuantity = usedUpQuantity
    self.wornOutQuantity = wornOutQuantity
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    name = try container.decode(String.self, forKey: .name)
    coverImageUrl = try container.decodeIfPresent(String.self, forKey: .coverImageUrl)
    imageKey = try container.decodeIfPresent(String.self, forKey: .imageKey)
    modelCode = try container.decodeIfPresent(String.self, forKey: .modelCode)
    createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
    latestPurchaseDate = try container.decodeIfPresent(String.self, forKey: .latestPurchaseDate)
    referenceUnitPriceCny = try container.decodeFlexibleDoubleIfPresent(forKey: .referenceUnitPriceCny)
    brand = try container.decodeIfPresent(NamedRef.self, forKey: .brand)
    category = try container.decodeIfPresent(NamedRef.self, forKey: .category)
    profileDetails = try container.decodeIfPresent(GearProfileDetails.self, forKey: .profileDetails)
    ratings = try container.decodeIfPresent([GearRating].self, forKey: .ratings) ?? []
    totalQuantity = try container.decodeIfPresent(Int.self, forKey: .totalQuantity) ?? 0
    activeQuantity = try container.decodeIfPresent(Int.self, forKey: .activeQuantity) ?? 0
    usedUpQuantity = try container.decodeIfPresent(Int.self, forKey: .usedUpQuantity) ?? 0
    wornOutQuantity = try container.decodeIfPresent(Int.self, forKey: .wornOutQuantity) ?? 0
  }
}

struct GearWallResponse: Decodable {
  let items: [GearWallItem]
}

extension GearWallItem {
  var isPegboardDisplayable: Bool {
    let categoryName = resolvedCategoryNameForDisplay
    return categoryName.contains("羽毛球")
      || categoryName.contains("球拍")
      || categoryName.contains("球鞋")
  }

  private var resolvedCategoryNameForDisplay: String {
    if let categoryName = category?.name, !categoryName.isEmpty {
      return categoryName
    }
    let seed = [name, brand?.name, modelCode].compactMap { $0 }.joined(separator: " ").lowercased()
    if seed.contains("球拍") || seed.contains("racket") {
      return "球拍"
    }
    if seed.contains("球鞋") || seed.contains("shoe") {
      return "球鞋"
    }
    if seed.contains("羽毛球") || seed.contains("shuttle") {
      return "羽毛球"
    }
    return "其他"
  }
}

enum PegboardLayoutMode: String, Codable, CaseIterable, Identifiable {
  case active
  case history

  var id: String { rawValue }

  var label: String {
    switch self {
    case .active: "在用"
    case .history: "历史"
    }
  }
}

struct PegboardLayoutSlot: Codable, Hashable {
  let x: Double
  let y: Double
  let scale: Double
  let rotate: Double
  let z: Int
}

struct PegboardLayoutSnapshot: Codable, Hashable {
  let v: Int
  let height: Int
  let slots: [String: PegboardLayoutSlot]
}

struct PegboardLayoutStore: Codable, Hashable {
  var active: PegboardLayoutSnapshot?
  var history: PegboardLayoutSnapshot?

  static let empty = PegboardLayoutStore(active: nil, history: nil)

  subscript(mode: PegboardLayoutMode) -> PegboardLayoutSnapshot? {
    switch mode {
    case .active: active
    case .history: history
    }
  }
}

struct PegboardLayoutResponse: Decodable {
  let layouts: PegboardLayoutStore
}

struct WishlistItem: Codable, Identifiable, Hashable {
  let id: String
  let name: String
  let targetPriceCny: Double?
  let currentSeenPriceCny: Double?
  let priceRecordedAt: String?
  let priority: Int
  let status: WishlistStatus
  let sourceUrl: String?
  let imageUrl: String?
  let notes: String?
  let brand: NamedRef?
  let category: NamedRef?

  enum CodingKeys: String, CodingKey {
    case id
    case name
    case targetPriceCny
    case currentSeenPriceCny
    case priceRecordedAt
    case priority
    case status
    case sourceUrl
    case imageUrl
    case notes
    case brand
    case category
  }

  init(
    id: String,
    name: String,
    targetPriceCny: Double?,
    currentSeenPriceCny: Double?,
    priority: Int,
    status: WishlistStatus,
    sourceUrl: String?,
    imageUrl: String?,
    notes: String?,
    brand: NamedRef?,
    category: NamedRef?,
    priceRecordedAt: String? = nil
  ) {
    self.id = id
    self.name = name
    self.priceRecordedAt = priceRecordedAt
    self.targetPriceCny = targetPriceCny
    self.currentSeenPriceCny = currentSeenPriceCny
    self.priority = priority
    self.status = status
    self.sourceUrl = sourceUrl
    self.imageUrl = imageUrl
    self.notes = notes
    self.brand = brand
    self.category = category
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    name = try container.decode(String.self, forKey: .name)
    targetPriceCny = try container.decodeFlexibleDoubleIfPresent(forKey: .targetPriceCny)
    currentSeenPriceCny = try container.decodeFlexibleDoubleIfPresent(forKey: .currentSeenPriceCny)
    priceRecordedAt = try container.decodeIfPresent(String.self, forKey: .priceRecordedAt)
    priority = try container.decodeIfPresent(Int.self, forKey: .priority) ?? 3
    status = try container.decodeIfPresent(WishlistStatus.self, forKey: .status) ?? .want
    sourceUrl = try container.decodeIfPresent(String.self, forKey: .sourceUrl)
    imageUrl = try container.decodeIfPresent(String.self, forKey: .imageUrl)
    notes = try container.decodeIfPresent(String.self, forKey: .notes)
    brand = try container.decodeIfPresent(NamedRef.self, forKey: .brand)
    category = try container.decodeIfPresent(NamedRef.self, forKey: .category)
  }
}

extension WishlistItem {
  func replacingStatus(_ newStatus: WishlistStatus) -> WishlistItem {
    WishlistItem(
      id: id,
      name: name,
      targetPriceCny: targetPriceCny,
      currentSeenPriceCny: currentSeenPriceCny,
      priority: priority,
      status: newStatus,
      sourceUrl: sourceUrl,
      imageUrl: imageUrl,
      notes: notes,
      brand: brand,
      category: category,
      priceRecordedAt: priceRecordedAt
    )
  }
}

struct WishlistEditInput {
  var name: String
  var targetPriceCny: Double?
  var currentSeenPriceCny: Double?
  var priority: Int
  var status: WishlistStatus
  var sourceUrl: String?
  var imageUrl: String?
  var notes: String?
  var brandName: String?
  var categoryName: String?
}

struct WishlistResponse: Decodable {
  let items: [WishlistItem]
}

struct AnalyticsData: Decodable, Hashable {
  var range: String
  var availableYears: [Int]
  var trend: [TrendPoint]
  var brandShare: [BrandShare]
  var categoryShare: [CategoryShare]
  var frequency: [FrequencyPoint]
  var wishlistCounts: [WishlistCount]
  var gearRanking: [GearRank]
}

struct TrendPoint: Decodable, Hashable {
  let bucket: String
  let amount: Double
}

struct BrandShare: Decodable, Hashable {
  let brand: String
  let amount: Double
}

struct CategoryShare: Decodable, Hashable {
  let category: String
  let amount: Double
}

struct FrequencyPoint: Decodable, Hashable {
  let bucket: String
  let count: Int
}

struct AnalyticsYAxisScale: Hashable {
  let domain: ClosedRange<Double>
  let marks: [Double]

  static func make(maxValue: Double, desiredTickCount: Int = 4, forceIntegerSteps: Bool = false) -> AnalyticsYAxisScale {
    guard maxValue > 0 else {
      return AnalyticsYAxisScale(domain: 0...1, marks: [0, 1])
    }

    let tickCount = max(1, desiredTickCount)
    let roughStep = maxValue / Double(tickCount)
    let step = forceIntegerSteps
      ? max(1, ceil(roughStep))
      : niceStep(for: roughStep)
    let domainMax = max(step, ceil(maxValue / step) * step)
    let markCount = Int(round(domainMax / step))
    let marks = (0...markCount).map { Double($0) * step }
    return AnalyticsYAxisScale(domain: 0...domainMax, marks: marks)
  }

  private static func niceStep(for roughStep: Double) -> Double {
    guard roughStep > 0 else { return 1 }
    let exponent = floor(log10(roughStep))
    let magnitude = pow(10, exponent)
    let normalized = roughStep / magnitude
    let niceNormalized: Double
    if normalized <= 1 {
      niceNormalized = 1
    } else if normalized <= 2 {
      niceNormalized = 2
    } else if normalized <= 5 {
      niceNormalized = 5
    } else {
      niceNormalized = 10
    }
    return niceNormalized * magnitude
  }
}

struct WishlistCount: Decodable, Hashable {
  let status: WishlistStatus
  let count: Int
}

struct GearRank: Decodable, Identifiable, Hashable {
  let id: String
  let name: String
  let overall: Double
}

extension AnalyticsData {
  static let empty = AnalyticsData(
    range: "all",
    availableYears: [],
    trend: [],
    brandShare: [],
    categoryShare: [],
    frequency: [],
    wishlistCounts: [],
    gearRanking: []
  )

  func replacingTotals(from purchases: [PurchaseRecord]) -> AnalyticsData {
    var copy = self
    copy.trend = [
      TrendPoint(bucket: "当前", amount: purchases.reduce(0) { $0 + $1.totalPriceCny })
    ]
    return copy
  }
}

extension KeyedDecodingContainer {
  func decodeFlexibleDouble(forKey key: Key) throws -> Double {
    if let value = try? decode(Double.self, forKey: key) {
      return value
    }
    if let value = try? decode(Int.self, forKey: key) {
      return Double(value)
    }
    if let value = try? decode(String.self, forKey: key), let number = Double(value) {
      return number
    }
    return 0
  }

  func decodeFlexibleDoubleIfPresent(forKey key: Key) throws -> Double? {
    if !contains(key) {
      return nil
    }
    if try decodeNil(forKey: key) {
      return nil
    }
    return try decodeFlexibleDouble(forKey: key)
  }
}


enum ConsumptionValidationError: LocalizedError {
  case invalidQuantity, invalidDate, incompatibleStatus, missingPurchase
  var errorDescription: String? {
    switch self {
    case .invalidQuantity: "用完数量不能超过购买数量，且每次至少为 1。"
    case .invalidDate: "请检查日期：启用和用完日期不能早于购买日期，也不能晚于今天。"
    case .incompatibleStatus: "已有消耗记录，请通过记录消耗来更新状态。"
    case .missingPurchase: "这条购买记录已不存在。"
    }
  }
}

extension PurchaseEditInput {
  func validateConsumption(existing: PurchaseRecord, now: Date = Date()) throws {
    let records = consumptionRecords ?? existing.consumptionRecords
    guard quantity > 0, records.allSatisfy({ $0.quantity > 0 && $0.quantity <= quantity }),
          records.reduce(0, { $0 + $1.quantity }) <= quantity else {
      throw ConsumptionValidationError.invalidQuantity
    }
    guard records.isEmpty || itemStatus != .usedUp else { throw ConsumptionValidationError.incompatibleStatus }
    let calendar = Calendar.current
    guard let purchase = AppDate.parseISODate(purchaseDate) else { throw ConsumptionValidationError.invalidDate }
    let firstDay = calendar.startOfDay(for: purchase)
    let today = calendar.startOfDay(for: now)
    for record in records {
      guard let rawEnd = record.finishedDate else {
        // Old records may have no known completion date. Preserve that uncertainty.
        guard existing.consumptionHistory.contains(record) else { throw ConsumptionValidationError.invalidDate }
        continue
      }
      guard let end = AppDate.parseISODate(rawEnd), calendar.startOfDay(for: end) >= firstDay,
            calendar.startOfDay(for: end) <= today else { throw ConsumptionValidationError.invalidDate }
      if let rawStart = record.startedDate {
        guard let start = AppDate.parseISODate(rawStart), calendar.startOfDay(for: start) >= firstDay,
              start <= end else { throw ConsumptionValidationError.invalidDate }
      }
    }
  }
}

/// Shared grouping keys keep chart totals and their purchase lists in agreement.
enum AnalyticsPurchaseDimension: Hashable {
  case channel(String)
  case brand(String)
  case category(String)
  case period(String)
  case purchasePeriod(String)
  case stringModel(String)

  var title: String {
    switch self {
    case .channel(let value), .brand(let value), .category(let value), .stringModel(let value): value
    case .period(let value), .purchasePeriod(let value): value.count == 4 ? "\(value) 年" : value.replacingOccurrences(of: "-", with: " 年 ") + " 月"
    }
  }

  func matches(_ purchase: PurchaseRecord) -> Bool {
    switch self {
    case .channel(let value): purchase.normalizedChannelName == value
    case .brand(let value): purchase.analyticsBrandName == value
    case .category(let value): purchase.analyticsCategoryName == value
    case .period(let value), .purchasePeriod(let value): purchase.analyticsBucket(annual: value.count == 4) == value
    case .stringModel: false
    }
  }
}

struct AnalyticsPurchaseFilter: Hashable, Identifiable {
  var id: Self { self }
  let range: String
  let dimension: AnalyticsPurchaseDimension

  static func inRange(_ purchases: [PurchaseRecord], range: String) -> [PurchaseRecord] {
    purchases.filter { range == "all" || $0.purchaseDate.hasPrefix(range) }
  }

  func records(in purchases: [PurchaseRecord]) -> [PurchaseRecord] {
    Self.inRange(purchases, range: range).filter { dimension.matches($0) }
      .sorted { left, right in
        if left.purchaseDate == right.purchaseDate { return left.id < right.id }
        return left.purchaseDate > right.purchaseDate
      }
  }

  /// The value returned by ChartProxy is a cumulative amount, not degrees.
  static func sectorIndex(value: Double, amounts: [Double]) -> Int? {
    guard value.isFinite, value >= 0 else { return nil }
    var end = 0.0
    for (index, amount) in amounts.enumerated() where amount.isFinite && amount > 0 {
      end += amount
      if value < end { return index }
    }
    return nil
  }
}

extension PurchaseRecord {
  var analyticsBrandName: String { brand?.name ?? "未标记品牌" }
  var analyticsCategoryName: String { category?.name ?? "其他" }
  func analyticsBucket(annual: Bool) -> String { String(purchaseDate.prefix(annual ? 4 : 7)) }
}

struct PurchaseTrendPoint: Identifiable {
  let date: Date
  let quantity: Int
  let price: Double?
  var id: Date { date }
}

struct PurchaseTrendSeries {
  let points: [PurchaseTrendPoint]
  let domain: ClosedRange<Date>
  let spansYears: Bool

  init(records: [PurchaseRecord], calendar: Calendar = .current) {
    let datedRecords = records.compactMap { record -> (Date, PurchaseRecord)? in
      guard let date = AppDate.parseISODate(record.purchaseDate) else { return nil }
      return (calendar.startOfDay(for: date), record)
    }
    points = Dictionary(grouping: datedRecords, by: { $0.0 }).map { day, entries in
      let purchases = entries.map { $0.1 }
      let priced = purchases.filter { $0.quantity > 0 && $0.effectiveUnitPriceCny != nil }
      let pricedQuantity = priced.reduce(0) { $0 + $1.quantity }
      let price = pricedQuantity > 0
        ? priced.reduce(0) { $0 + ($1.effectiveUnitPriceCny ?? 0) * Double($1.quantity) } / Double(pricedQuantity)
        : nil
      return PurchaseTrendPoint(date: day, quantity: purchases.reduce(0) { $0 + $1.quantity }, price: price)
    }.sorted { $0.date < $1.date }
    let first = points.first?.date ?? Date(timeIntervalSince1970: 0)
    let last = points.last?.date ?? first
    let padding = max(43_200, last.timeIntervalSince(first) * 0.05)
    domain = first.addingTimeInterval(-padding)...last.addingTimeInterval(padding)
    spansYears = calendar.component(.year, from: first) != calendar.component(.year, from: last)
  }

  func barWidth(plotWidth: CGFloat) -> CGFloat {
    let gaps = zip(points, points.dropFirst()).map { $1.date.timeIntervalSince($0.date) }
    guard let gap = gaps.min() else { return 18 }
    let available = max(0, plotWidth) * gap / domain.upperBound.timeIntervalSince(domain.lowerBound)
    return min(18, max(1, available * 0.65))
  }
}
