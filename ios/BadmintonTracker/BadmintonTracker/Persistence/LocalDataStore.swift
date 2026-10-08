import Foundation
import SwiftData

struct LocalAppData {
  var purchases: [PurchaseRecord]
  var gearItems: [GearItem]
  var gearWallItems: [GearWallItem]
  var pegboardLayouts: PegboardLayoutStore
  var wishlistItems: [WishlistItem]
  var analytics: AnalyticsData
}

struct PreparedBackup: Identifiable {
  let id = UUID()
  let data: Data
  let isLegacy: Bool
  let purchaseCount: Int
  let wishlistCount: Int
  let photoCount: Int
  let exportedAt: String?
}

@MainActor
struct LocalDataStore {
  private let context: ModelContext
  private let legacyFileURL: URL
  private let bundle: Bundle
  private static let manifestFileName = "manifest.json"
  private static let photosDirectoryName = "photos"
  private static let legacyImportMetadataKey = "legacyJSONImported"
  private static let pegboardLayoutKey = "default"

  /// Decode and validate without touching the database or restoring any media.
  static func prepareBackup(data: Data, isLegacy: Bool = false) throws -> PreparedBackup {
    let snapshot: LocalAppSnapshot
    var manifest: LocalBackupManifest?
    if isLegacy {
      snapshot = try decoder.decode(LocalAppSnapshot.self, from: data)
    } else {
      let decoded = try decoder.decode(LocalBackupManifest.self, from: data)
      guard decoded.formatVersion == 2 else { throw BackupPreviewError.unsupportedVersion }
      guard decoded.files.allSatisfy({ $0.dataBase64.flatMap { Data(base64Encoded: $0) } != nil }) else {
        throw BackupPreviewError.missingPhotos
      }
      snapshot = decoded.data
      manifest = decoded
    }
    guard (1...2).contains(snapshot.version),
          Set(snapshot.purchases.map(\.id)).count == snapshot.purchases.count,
          Set(snapshot.wishlistItems.map(\.id)).count == snapshot.wishlistItems.count else {
      throw BackupPreviewError.invalidData
    }
    return PreparedBackup(data: data, isLegacy: isLegacy, purchaseCount: snapshot.purchases.count,
      wishlistCount: snapshot.wishlistItems.count, photoCount: manifest?.files.count ?? 0,
      exportedAt: manifest?.exportedAt)
  }

  static func prepareBackup(package: FileWrapper) throws -> PreparedBackup {
    guard let data = package.fileWrappers?[manifestFileName]?.regularFileContents else {
      throw BackupPreviewError.invalidData
    }
    let manifest = try decoder.decode(LocalBackupManifest.self, from: data)
    let files = try manifest.files.map { file in
      var wrapper = package
      for component in file.relativePath.split(separator: "/") {
        guard component != "..", let next = wrapper.fileWrappers?[String(component)] else {
          throw BackupPreviewError.missingPhotos
        }
        wrapper = next
      }
      guard let bytes = wrapper.regularFileContents else { throw BackupPreviewError.missingPhotos }
      return LocalBackupFile(originalURLString: file.originalURLString,
        relativePath: file.relativePath, dataBase64: bytes.base64EncodedString())
    }
    return try prepareBackup(data: encoder.encode(LocalBackupManifest(formatVersion: manifest.formatVersion,
      exportedAt: manifest.exportedAt, data: manifest.data, files: files)))
  }

  init(context: ModelContext, legacyFileURL: URL? = nil, bundle: Bundle = .main) {
    self.context = context
    self.bundle = bundle
    let supportURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appending(path: "BadmintonTracker", directoryHint: .isDirectory)
    self.legacyFileURL = legacyFileURL ?? supportURL.appending(path: "local-data.json")
  }

  func load() throws -> LocalAppData {
    let snapshot = try loadSnapshot()
    return makeAppData(from: snapshot)
  }

  func createPurchase(_ input: PurchaseInput) throws -> LocalAppData {
    var snapshot = try loadSnapshot()
    let record = makePurchaseRecord(from: input, existingPurchases: snapshot.purchases)
    snapshot.purchases.insert(record, at: 0)
    try save(snapshot)
    return makeAppData(from: snapshot)
  }

  func purchaseWishlistItem(id: String, purchaseInput: PurchaseInput) throws -> LocalAppData {
    var snapshot = try loadSnapshot()
    guard snapshot.wishlistItems.contains(where: { $0.id == id }) else {
      throw WishlistConversionError.itemNotFound
    }

    snapshot.purchases.insert(
      makePurchaseRecord(from: purchaseInput, existingPurchases: snapshot.purchases),
      at: 0
    )
    snapshot.wishlistItems = snapshot.wishlistItems.map { item in
      item.id == id ? item.replacingStatus(.purchased) : item
    }
    try save(snapshot)
    return makeAppData(from: snapshot)
  }

  func updateGearItem(id: String, input: GearEditInput) throws -> LocalAppData {
    var snapshot = try loadSnapshot()
    let brand = input.brandName.flatMap { value -> NamedRef? in
      guard let canonicalName = LocalBrandNormalizer.canonicalName(value) else { return nil }
      return NamedRef(id: localStableID(prefix: "brand", value: canonicalName), name: canonicalName)
    }
    let category = NamedRef(id: localStableID(prefix: "category", value: input.categoryName), name: input.categoryName)
    snapshot.purchases = snapshot.purchases.map { purchase in
      guard LocalGearIdentity.id(for: purchase) == id else { return purchase }
      let currentCoverImageUrl = input.gearCoverImageUrl ?? purchase.gearItem?.coverImageUrl
      let imageKey = currentCoverImageUrl == nil
        ? purchase.gearItem?.imageKey ?? localCatalogImageKey(
          name: input.name,
          brandName: brand?.name,
          modelCode: input.modelCode,
          categoryName: category.name
        ) ?? LocalGearImageMatcher.imageKey(
          name: input.name,
          brandName: brand?.name,
          categoryName: category.name
        )
        : purchase.gearItem?.imageKey

      return purchase.replacingGearDetails(
        name: input.name,
        brand: brand,
        category: category,
        modelCode: input.modelCode,
        gearID: id,
        coverImageUrl: currentCoverImageUrl,
        imageKey: input.gearCoverImageUrl == nil ? imageKey : nil,
        profileDetails: input.profileDetails,
        itemStatus: purchase.itemStatus
      )
    }

    try save(snapshot)
    return makeAppData(from: snapshot)
  }

  func updatePurchaseRecord(id: String, input: PurchaseEditInput) throws -> LocalAppData {
    var snapshot = try loadSnapshot()
    guard let existing = snapshot.purchases.first(where: { $0.id == id }) else {
      throw ConsumptionValidationError.missingPurchase
    }
    try input.validateConsumption(existing: existing)
    snapshot.purchases = snapshot.purchases.map { purchase in
      guard purchase.id == id else { return purchase }
      return purchase.replacingPurchaseDetails(input)
    }
    try save(snapshot)
    return makeAppData(from: snapshot)
  }

  func createWishlistItem(_ input: WishlistEditInput) throws -> LocalAppData {
    var snapshot = try loadSnapshot()
    snapshot.wishlistItems.insert(makeWishlistItem(from: input), at: 0)
    try save(snapshot)
    return try load()
  }

  func updateWishlistItem(id: String, input: WishlistEditInput) throws -> LocalAppData {
    var snapshot = try loadSnapshot()
    snapshot.wishlistItems = snapshot.wishlistItems.map { item in
      guard item.id == id else { return item }
      return makeWishlistItem(from: input, id: id, previous: item)
    }
    try save(snapshot)
    return try load()
  }

  func restoreWishlistItem(_ item: WishlistItem) throws -> LocalAppData {
    var snapshot = try loadSnapshot()
    guard !snapshot.wishlistItems.contains(where: { $0.id == item.id }) else { return try load() }
    snapshot.wishlistItems.insert(item, at: 0)
    try save(snapshot)
    return try load()
  }

  func deleteWishlistItem(id: String) throws -> LocalAppData {
    var snapshot = try loadSnapshot()
    snapshot.wishlistItems.removeAll { $0.id == id }
    try save(snapshot)
    return try load()
  }

  func deleteGearItem(id: String) throws -> LocalAppData {
    var snapshot = try loadSnapshot()
    snapshot.purchases.removeAll { purchase in
      LocalGearIdentity.id(for: purchase) == id
    }
    try save(snapshot)
    return makeAppData(from: snapshot)
  }

  func reset() throws -> LocalAppData {
    let snapshot = LocalAppSnapshot()
    try save(snapshot)
    return makeAppData(from: snapshot)
  }

  func exportBackupData() throws -> Data {
    let snapshot = try loadSnapshot()
    return try Self.encoder.encode(snapshot)
  }

  func exportBackupPackageData() throws -> Data {
    let snapshot = try loadSnapshot()
    let attachments = try backupAttachments(from: snapshot)
    let files = try attachments.map { attachment in
      let data = try Data(contentsOf: attachment.sourceURL)
      return LocalBackupFile(
        originalURLString: attachment.manifestFile.originalURLString,
        relativePath: attachment.manifestFile.relativePath,
        dataBase64: data.base64EncodedString()
      )
    }

    return try Self.encoder.encode(
      LocalBackupManifest(
        exportedAt: ISO8601DateFormatter().string(from: Date()),
        data: snapshot,
        files: files
      )
    )
  }

  func exportBackupPackage() throws -> FileWrapper {
    let snapshot = try loadSnapshot()
    let attachments = try backupAttachments(from: snapshot)
    var fileWrappers: [String: FileWrapper] = [
      Self.manifestFileName: FileWrapper(
        regularFileWithContents: try Self.encoder.encode(
          LocalBackupManifest(
            exportedAt: ISO8601DateFormatter().string(from: Date()),
            data: snapshot,
            files: attachments.map(\.manifestFile)
          )
        )
      )
    ]

    if !attachments.isEmpty {
      var photoWrappers: [String: FileWrapper] = [:]
      for attachment in attachments {
        let data = try Data(contentsOf: attachment.sourceURL)
        photoWrappers[attachment.packageFileName] = FileWrapper(regularFileWithContents: data)
      }
      fileWrappers[Self.photosDirectoryName] = FileWrapper(directoryWithFileWrappers: photoWrappers)
    }

    let wrapper = FileWrapper(directoryWithFileWrappers: fileWrappers)
    wrapper.preferredFilename = "badminton-tracker.btbackup"
    return wrapper
  }

  func importBackupData(_ data: Data) throws -> LocalAppData {
    var snapshot = try Self.decoder.decode(LocalAppSnapshot.self, from: data)
    snapshot.version = max(1, snapshot.version)
    try save(snapshot)
    return makeAppData(from: snapshot)
  }

  func importBackupPackageData(_ data: Data) throws -> LocalAppData {
    let manifest = try Self.decoder.decode(LocalBackupManifest.self, from: data)
    return try importBackupManifest(manifest, wrapper: nil)
  }

  func importBackupPackage(at url: URL) throws -> LocalAppData {
    let wrapper = try FileWrapper(url: url, options: [])
    return try importBackupPackage(wrapper)
  }

  func importBackupPackage(_ wrapper: FileWrapper) throws -> LocalAppData {
    guard let manifestData = wrapper.fileWrappers?[Self.manifestFileName]?.regularFileContents else {
      throw LocalBackupError.missingManifest
    }

    let manifest = try Self.decoder.decode(LocalBackupManifest.self, from: manifestData)
    return try importBackupManifest(manifest, wrapper: wrapper)
  }

  private func importBackupManifest(_ manifest: LocalBackupManifest, wrapper: FileWrapper?) throws -> LocalAppData {
    var snapshot = manifest.data
    snapshot.version = max(1, snapshot.version)
    let remappedURLs = try restoreBackupFiles(manifest.files, from: wrapper)
    snapshot = snapshot.replacingFileURLs(remappedURLs)
    try save(snapshot)
    return makeAppData(from: snapshot)
  }

  private func loadSnapshot() throws -> LocalAppSnapshot {
    try CatalogSeedService(context: context, bundle: bundle).importBundledSeedIfNeeded()
    try importLegacyJSONIfNeeded()
    return try snapshotFromSwiftData()
  }

  private func save(_ snapshot: LocalAppSnapshot) throws {
    try persist(snapshot)
  }

  private func importLegacyJSONIfNeeded() throws {
    let metadata = try context.fetch(FetchDescriptor<AppMetadataEntity>())
    guard !metadata.contains(where: { $0.key == Self.legacyImportMetadataKey }) else {
      return
    }

    let hasUserData = try !context.fetch(FetchDescriptor<PurchaseRecordEntity>()).isEmpty
      || !context.fetch(FetchDescriptor<WishlistItemEntity>()).isEmpty
      || !context.fetch(FetchDescriptor<UserEquipmentEntity>()).isEmpty

    if !hasUserData, FileManager.default.fileExists(atPath: legacyFileURL.path) {
      let data = try Data(contentsOf: legacyFileURL)
      var snapshot = try Self.decoder.decode(LocalAppSnapshot.self, from: data)
      snapshot.version = max(1, snapshot.version)
      try persist(snapshot)
    }

    context.insert(AppMetadataEntity(
      key: Self.legacyImportMetadataKey,
      integerValue: 1
    ))
    try context.save()
  }

  private func snapshotFromSwiftData() throws -> LocalAppSnapshot {
    let users = try context.fetch(FetchDescriptor<UserEquipmentEntity>())
      .filter { $0.deletedAt == nil }
    let usersByID = Dictionary(uniqueKeysWithValues: users.map { ($0.id, $0) })
    let stringingByOwner = Dictionary(
      grouping: try context.fetch(FetchDescriptor<StringingRecordEntity>()),
      by: \.userEquipmentID
    )

    let purchases = try context.fetch(FetchDescriptor<PurchaseRecordEntity>())
      .compactMap { entity -> PurchaseRecord? in
        guard let userEquipment = usersByID[entity.userEquipmentID] else { return nil }
        let brand = userEquipment.customBrand.map {
          NamedRef(id: StableUUID.from("brand:\($0)").uuidString, name: $0)
        }
        let categoryName = userEquipment.categoryRawValue
        let category = NamedRef(
          id: StableUUID.from("category:\(categoryName)").uuidString,
          name: categoryName
        )
        return PurchaseRecord(
          id: entity.id.uuidString,
          itemNameSnapshot: entity.itemNameSnapshot,
          unitPriceCny: entity.unitPriceCny,
          quantity: entity.quantity,
          totalPriceCny: entity.totalPriceCny,
          itemStatus: ItemStatus(rawValue: entity.itemStatusRawValue) ?? .inUse,
          purchaseDate: entity.purchaseDate,
          statusDate: entity.statusDate,
          consumptionRecords: try entity.consumptionRecordsData.map { try JSONDecoder().decode([ConsumptionRecord].self, from: $0) } ?? [],
          channel: entity.channel,
          notes: entity.notes,
          brand: brand,
          category: category,
          gearItem: GearSummary(
            id: userEquipment.id.uuidString,
            catalogEquipmentID: userEquipment.catalogEquipmentID,
            modelCode: userEquipment.customModel,
            coverImageUrl: userEquipment.coverImageReference,
            imageKey: userEquipment.imageKey,
            profileDetails: userEquipment.profileDetails(
              stringingRecords: stringingByOwner[userEquipment.id] ?? []
            )
          )
        )
      }

    let wishlistItems = try context.fetch(FetchDescriptor<WishlistItemEntity>()).map { entity in
      WishlistItem(
        id: entity.id.uuidString,
        name: entity.name,
        targetPriceCny: entity.targetPriceCny,
        currentSeenPriceCny: entity.currentSeenPriceCny,
        priority: entity.priority,
        status: WishlistStatus(rawValue: entity.statusRawValue) ?? .want,
        sourceUrl: entity.sourceURLString,
        imageUrl: entity.imageReference,
        notes: entity.notes,
        brand: entity.brandName.map {
          NamedRef(id: StableUUID.from("brand:\($0)").uuidString, name: $0)
        },
        category: entity.categoryName.map {
          NamedRef(id: StableUUID.from("category:\($0)").uuidString, name: $0)
        },
        priceRecordedAt: entity.priceRecordedAt
      )
    }

    let pegboardLayouts = try context.fetch(FetchDescriptor<PegboardLayoutEntity>())
      .first(where: { $0.key == Self.pegboardLayoutKey })
      .flatMap { try? Self.decoder.decode(PegboardLayoutStore.self, from: $0.valueData) }
      ?? .empty

    return LocalAppSnapshot(
      version: 2,
      purchases: purchases,
      wishlistItems: wishlistItems,
      pegboardLayouts: pegboardLayouts
    )
  }

  private func persist(_ snapshot: LocalAppSnapshot) throws {
    var committed = false
    defer { if !committed { context.rollback() } }
    let now = Date()
    let existingUsers = try context.fetch(FetchDescriptor<UserEquipmentEntity>())
    let usersByID = Dictionary(uniqueKeysWithValues: existingUsers.map { ($0.id, $0) })
    let catalogEntries = try context.fetch(FetchDescriptor<CatalogEquipmentEntity>())
      .map(\.domainModel)
      .map(LocalGearCatalogEntry.init)
    let purchaseGroups = Dictionary(grouping: snapshot.purchases, by: LocalGearIdentity.id(for:))
    var retainedUserIDs: Set<UUID> = []
    var retainedMediaIDs: Set<UUID> = []

    for (identity, records) in purchaseGroups {
      guard let latest = records.max(by: { $0.purchaseDate < $1.purchaseDate }) else { continue }
      let userEquipmentID = UUID(uuidString: identity) ?? StableUUID.from("user-equipment:\(identity)")
      retainedUserIDs.insert(userEquipmentID)
      let catalogEquipmentID = latest.gearItem?.catalogEquipmentID
        ?? LocalGearCatalog.entry(
          matchingName: latest.itemNameSnapshot,
          brandName: latest.brand?.name,
          modelCode: latest.gearItem?.modelCode,
          categoryName: latest.category?.name,
          entries: catalogEntries
        )?.catalogEquipmentID
      let category = EquipmentCategory(name: latest.category?.name ?? "其他")
      let createdAt = records.compactMap { AppDate.parseISODate($0.purchaseDate) }.min() ?? now
      let entity: UserEquipmentEntity

      if let existing = usersByID[userEquipmentID] {
        entity = existing
        entity.catalogEquipmentID = catalogEquipmentID
        entity.legacyIdentity = identity
        entity.customName = latest.itemNameSnapshot
        entity.customBrand = latest.brand?.name
        entity.customModel = latest.gearItem?.modelCode
        entity.categoryRawValue = category.rawValue
        entity.notes = latest.notes
        entity.coverImageReference = latest.gearItem?.coverImageUrl
        entity.imageKey = latest.gearItem?.imageKey
        entity.updatedAt = now
        entity.deletedAt = nil
      } else {
        entity = UserEquipmentEntity(
          id: userEquipmentID,
          catalogEquipmentID: catalogEquipmentID,
          legacyIdentity: identity,
          customName: latest.itemNameSnapshot,
          customBrand: latest.brand?.name,
          customModel: latest.gearItem?.modelCode,
          customVariant: nil,
          category: category,
          notes: latest.notes,
          coverImageReference: latest.gearItem?.coverImageUrl,
          imageKey: latest.gearItem?.imageKey,
          createdAt: createdAt,
          updatedAt: now
        )
        context.insert(entity)
      }
      entity.applyProfileDetails(latest.gearItem?.profileDetails, context: context)

      if let reference = latest.gearItem?.coverImageUrl,
         let files = GearPhotoProcessor.mediaFiles(for: reference) {
        retainedMediaIDs.insert(files.id)
        try upsertMediaAsset(files: files, ownerID: userEquipmentID, now: now)
      }
    }

    // Repository-created equipment may exist without a purchase. Only remove the
    // purchase-derived records that disappeared from this legacy feature snapshot.
    for user in existingUsers where user.legacyIdentity != nil && !retainedUserIDs.contains(user.id) {
      context.delete(user)
    }

    let existingPurchases = try context.fetch(FetchDescriptor<PurchaseRecordEntity>())
    let purchasesByID = Dictionary(uniqueKeysWithValues: existingPurchases.map { ($0.id, $0) })
    var retainedPurchaseIDs: Set<UUID> = []
    for record in snapshot.purchases {
      let purchaseID = StableUUID.from(record.id)
      let identity = LocalGearIdentity.id(for: record)
      let userEquipmentID = UUID(uuidString: identity) ?? StableUUID.from("user-equipment:\(identity)")
      retainedPurchaseIDs.insert(purchaseID)
      if let entity = purchasesByID[purchaseID] {
        entity.userEquipmentID = userEquipmentID
        entity.apply(record)
      } else {
        context.insert(PurchaseRecordEntity(
          id: purchaseID,
          userEquipmentID: userEquipmentID,
          record: record
        ))
      }
    }
    existingPurchases.filter { !retainedPurchaseIDs.contains($0.id) }.forEach(context.delete)

    let existingWishlist = try context.fetch(FetchDescriptor<WishlistItemEntity>())
    let wishlistByID = Dictionary(uniqueKeysWithValues: existingWishlist.map { ($0.id, $0) })
    var retainedWishlistIDs: Set<UUID> = []
    for item in snapshot.wishlistItems {
      let id = StableUUID.from(item.id)
      retainedWishlistIDs.insert(id)
      if let entity = wishlistByID[id] {
        entity.apply(item)
      } else {
        context.insert(WishlistItemEntity(id: id, item: item))
      }
    }
    existingWishlist.filter { !retainedWishlistIDs.contains($0.id) }.forEach(context.delete)

    let layoutData = try Self.encoder.encode(snapshot.pegboardLayouts)
    let layouts = try context.fetch(FetchDescriptor<PegboardLayoutEntity>())
    if let layout = layouts.first(where: { $0.key == Self.pegboardLayoutKey }) {
      layout.valueData = layoutData
    } else {
      context.insert(PegboardLayoutEntity(valueData: layoutData))
    }

    let existingUserMedia = try context.fetch(FetchDescriptor<MediaAssetEntity>())
      .filter { $0.ownerTypeRawValue == MediaOwnerType.userEquipment.rawValue }
    let staleMedia = existingUserMedia.filter { !retainedMediaIDs.contains($0.id) }
    let staleMediaIDs = staleMedia.map(\.id)
    staleMedia.forEach(context.delete)

    try context.save()
    committed = true
    for id in staleMediaIDs { try? GearPhotoProcessor.deleteMedia(id: id) }
  }

  private func upsertMediaAsset(files: LocalMediaFiles, ownerID: UUID, now: Date) throws {
    let media = try context.fetch(FetchDescriptor<MediaAssetEntity>())
    if let existing = media.first(where: { $0.id == files.id }) {
      existing.ownerTypeRawValue = MediaOwnerType.userEquipment.rawValue
      existing.ownerID = ownerID
      existing.sourceTypeRawValue = MediaSourceType.userImported.rawValue
      existing.localOriginalPath = files.originalRelativePath
      existing.localProcessedPath = files.processedRelativePath
      existing.localThumbnailPath = files.thumbnailRelativePath
      existing.processingVersion = 1
      existing.updatedAt = now
      return
    }

    context.insert(MediaAssetEntity(asset: MediaAsset(
      id: files.id,
      ownerType: .userEquipment,
      ownerID: ownerID,
      sourceType: .userImported,
      localOriginalPath: files.originalRelativePath,
      localProcessedPath: files.processedRelativePath,
      localThumbnailPath: files.thumbnailRelativePath,
      remoteOriginalURL: nil,
      remoteProcessedURL: nil,
      remoteThumbnailURL: nil,
      processingVersion: 1,
      createdAt: now,
      updatedAt: now
    )))
  }

  private var photoFolderURL: URL {
    legacyFileURL.deletingLastPathComponent()
      .appending(path: "GearPhotos", directoryHint: .isDirectory)
  }

  private func backupAttachments(from snapshot: LocalAppSnapshot) throws -> [LocalBackupAttachment] {
    let references = snapshot.localFileImageReferences()
    var attachments: [LocalBackupAttachment] = []
    var seen: Set<String> = []

    for reference in references {
      guard !seen.contains(reference),
            let sourceURL = localImageFileURL(for: reference),
            FileManager.default.fileExists(atPath: sourceURL.path) else {
        continue
      }

      seen.insert(reference)
      let packageFileName = Self.packagePhotoFileName(index: attachments.count + 1, sourceURL: sourceURL)
      attachments.append(
        LocalBackupAttachment(
          sourceURL: sourceURL,
          packageFileName: packageFileName,
          manifestFile: LocalBackupFile(
            originalURLString: reference,
            relativePath: "\(Self.photosDirectoryName)/\(packageFileName)"
          )
        )
      )
    }

    return attachments
  }

  private func restoreBackupFiles(_ files: [LocalBackupFile], from wrapper: FileWrapper?) throws -> [String: String] {
    guard !files.isEmpty else { return [:] }

    try FileManager.default.createDirectory(at: photoFolderURL, withIntermediateDirectories: true)
    var remappedURLs: [String: String] = [:]

    for file in files {
      let embeddedData = file.dataBase64.flatMap { Data(base64Encoded: $0) }
      let packageData = wrapper.flatMap { regularFileData(in: $0, relativePath: file.relativePath) }
      guard let data = embeddedData ?? packageData else {
        continue
      }

      let sourceName = URL(fileURLWithPath: file.relativePath).lastPathComponent
      let destinationName = Self.importedPhotoFileName(sourceName)
      let destinationURL = photoFolderURL.appending(path: destinationName)
      try data.write(to: destinationURL, options: [.atomic])
      remappedURLs[file.originalURLString] = GearPhotoProcessor.localPhotoReference(for: destinationURL)
    }

    return remappedURLs
  }

  private func localImageFileURL(for reference: String) -> URL? {
    if let localPhotoURL = GearPhotoProcessor.photoURL(for: reference),
       localPhotoURL.isFileURL {
      return localPhotoURL
    }

    guard let sourceURL = URL(string: reference),
          sourceURL.isFileURL else {
      return nil
    }

    return sourceURL
  }

  private func regularFileData(in wrapper: FileWrapper, relativePath: String) -> Data? {
    let parts = relativePath.split(separator: "/").map(String.init)
    guard !parts.isEmpty else { return nil }

    var current = wrapper
    for part in parts {
      guard let next = current.fileWrappers?[part] else {
        return nil
      }
      current = next
    }

    return current.regularFileContents
  }

  private static func packagePhotoFileName(index: Int, sourceURL: URL) -> String {
    let safeName = sourceURL.lastPathComponent
      .map { character -> Character in
        character.isLetter || character.isNumber || character == "." || character == "-" || character == "_"
          ? character
          : "-"
      }
    return "\(index)-\(String(safeName))"
  }

  private static func importedPhotoFileName(_ sourceName: String) -> String {
    "\(UUID().uuidString)-\(sourceName)"
  }

  private func makePurchaseRecord(
    from input: PurchaseInput,
    existingPurchases: [PurchaseRecord]
  ) -> PurchaseRecord {
    let id = UUID().uuidString
    let brand = input.brandName.flatMap { value -> NamedRef? in
      guard let canonicalName = LocalBrandNormalizer.canonicalName(value) else { return nil }
      return NamedRef(id: localStableID(prefix: "brand", value: canonicalName), name: canonicalName)
    }
    let categoryName = input.categoryName ?? input.categoryId ?? LocalGearCategory.infer(from: input.itemNameSnapshot).name
    let category = NamedRef(id: localStableID(prefix: "category", value: categoryName), name: categoryName)
    let identity = LocalGearIdentity.id(
      name: input.itemNameSnapshot,
      brandName: brand?.name,
      modelCode: input.modelCode,
      categoryName: category.name
    )
    let gearID = existingPurchases.first { purchase in
      if let catalogEquipmentID = input.catalogEquipmentID {
        return purchase.gearItem?.catalogEquipmentID == catalogEquipmentID
      }
      return LocalGearIdentity.id(for: purchase) == identity
    }?.gearItem?.id ?? UUID().uuidString
    let imageKey = input.gearCoverImageUrl == nil
      ? input.gearImageKey ?? localCatalogImageKey(
        name: input.itemNameSnapshot,
        brandName: brand?.name,
        modelCode: input.modelCode,
        categoryName: category.name
      ) ?? LocalGearImageMatcher.imageKey(
        name: input.itemNameSnapshot,
        brandName: brand?.name,
        categoryName: category.name
      )
      : nil

    return PurchaseRecord(
      id: id,
      itemNameSnapshot: input.itemNameSnapshot,
      unitPriceCny: input.unitPriceCny,
      quantity: input.quantity,
      totalPriceCny: input.totalPriceCny ?? input.unitPriceCny * Double(input.quantity),
      itemStatus: input.itemStatus,
      purchaseDate: input.purchaseDate,
      statusDate: nil,
      channel: input.channel,
      notes: input.notes,
      brand: brand,
      category: category,
      gearItem: GearSummary(
        id: gearID,
        catalogEquipmentID: input.catalogEquipmentID,
        modelCode: input.modelCode,
        coverImageUrl: input.gearCoverImageUrl,
        imageKey: imageKey,
        profileDetails: input.profileDetails
      )
    )
  }

  private func makeWishlistItem(from input: WishlistEditInput, id: String = "local-wishlist-\(UUID().uuidString)", previous: WishlistItem? = nil) -> WishlistItem {
    let trimmedBrand = input.brandName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    let canonicalBrand = trimmedBrand.flatMap(LocalBrandNormalizer.canonicalName)
    let trimmedCategory = input.categoryName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty

    return WishlistItem(
      id: id,
      name: input.name.trimmingCharacters(in: .whitespacesAndNewlines),
      targetPriceCny: input.targetPriceCny,
      currentSeenPriceCny: input.currentSeenPriceCny,
      priority: min(max(input.priority, 1), 5),
      status: input.status,
      sourceUrl: input.sourceUrl?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      imageUrl: input.imageUrl?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      notes: input.notes?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      brand: canonicalBrand.map { NamedRef(id: localStableID(prefix: "brand", value: $0), name: $0) },
      category: trimmedCategory.map { NamedRef(id: localStableID(prefix: "category", value: $0), name: $0) },
      priceRecordedAt: input.currentSeenPriceCny == nil ? nil : (previous?.currentSeenPriceCny == input.currentSeenPriceCny ? previous?.priceRecordedAt : ISO8601DateFormatter().string(from: Date()))
    )
  }

  private func makeAppData(from snapshot: LocalAppSnapshot) -> LocalAppData {
    let purchases = snapshot.purchases.map(resolvingPurchaseGearImage).sorted { left, right in
      left.purchaseDate > right.purchaseDate
    }
    let gearWallItems = makeGearWallItems(from: purchases)
    let gearItems = gearWallItems.map { item in
      GearItem(
        id: item.id,
        name: item.name,
        modelCode: item.modelCode,
        coverImageUrl: item.coverImageUrl,
        imageKey: item.imageKey,
        notes: nil,
        brand: item.brand,
        category: item.category,
        ratings: item.ratings
      )
    }

    return LocalAppData(
      purchases: purchases,
      gearItems: gearItems,
      gearWallItems: gearWallItems,
      pegboardLayouts: snapshot.pegboardLayouts,
      wishlistItems: snapshot.wishlistItems,
      analytics: Self.makeAnalytics(from: purchases, wishlistItems: snapshot.wishlistItems, range: "all")
    )
  }

  private func makeGearWallItems(from purchases: [PurchaseRecord]) -> [GearWallItem] {
    let groups = Dictionary(grouping: purchases) { purchase in
      LocalGearIdentity.id(for: purchase)
    }

    return groups.map { id, records in
      let sorted = records.sorted { $0.purchaseDate > $1.purchaseDate }
      let latest = sorted[0]
      let totalQuantity = records.reduce(0) { $0 + $1.quantity }
      let activeQuantity = records
        .filter { $0.itemStatus == .inUse }
        .reduce(0) { $0 + $1.remainingQuantity }
      let usedUpQuantity = records.reduce(0) { $0 + $1.consumedQuantity }
      let wornOutQuantity = records
        .filter { $0.itemStatus == .wornOut }
        .reduce(0) { $0 + $1.remainingQuantity }
      let imageKey = latest.gearItem?.imageKey ?? localCatalogImageKey(
        name: latest.itemNameSnapshot,
        brandName: latest.brand?.name,
        modelCode: latest.gearItem?.modelCode,
        categoryName: latest.category?.name
      ) ?? LocalGearImageMatcher.imageKey(
        name: latest.itemNameSnapshot,
        brandName: latest.brand?.name,
        categoryName: latest.category?.name
      )

      return GearWallItem(
        id: id,
        name: latest.itemNameSnapshot,
        coverImageUrl: latest.gearItem?.coverImageUrl,
        imageKey: imageKey,
        modelCode: latest.gearItem?.modelCode,
        createdAt: records.map(\.purchaseDate).min(),
        latestPurchaseDate: latest.purchaseDate,
        referenceUnitPriceCny: latest.unitPriceCny,
        brand: latest.brand,
        category: latest.category,
        profileDetails: latest.gearItem?.profileDetails,
        ratings: [],
        totalQuantity: totalQuantity,
        activeQuantity: activeQuantity,
        usedUpQuantity: usedUpQuantity,
        wornOutQuantity: wornOutQuantity
      )
    }
    .sorted {
      ($0.latestPurchaseDate ?? "") > ($1.latestPurchaseDate ?? "")
    }
  }

  private func resolvingPurchaseGearImage(_ purchase: PurchaseRecord) -> PurchaseRecord {
    let existingGearItem = purchase.gearItem
    let coverImageUrl = existingGearItem?.coverImageUrl
    let imageKey = coverImageUrl == nil
      ? existingGearItem?.imageKey ?? localCatalogImageKey(
        name: purchase.itemNameSnapshot,
        brandName: purchase.brand?.name,
        modelCode: existingGearItem?.modelCode,
        categoryName: purchase.category?.name
      ) ?? LocalGearImageMatcher.imageKey(
        name: purchase.itemNameSnapshot,
        brandName: purchase.brand?.name,
        categoryName: purchase.category?.name
      )
      : existingGearItem?.imageKey

    guard existingGearItem?.imageKey != imageKey || existingGearItem == nil else {
      return purchase
    }

    let gearID = existingGearItem?.id ?? LocalGearIdentity.id(
      name: purchase.itemNameSnapshot,
      brandName: purchase.brand?.name,
      modelCode: existingGearItem?.modelCode,
      categoryName: purchase.category?.name
    )

    return purchase.replacingGearSummary(
      GearSummary(
        id: gearID,
        catalogEquipmentID: existingGearItem?.catalogEquipmentID,
        modelCode: existingGearItem?.modelCode,
        coverImageUrl: coverImageUrl,
        imageKey: imageKey,
        profileDetails: existingGearItem?.profileDetails
      )
    )
  }

  static func makeAnalytics(from purchases: [PurchaseRecord], wishlistItems: [WishlistItem], range: String) -> AnalyticsData {
    let filtered = AnalyticsPurchaseFilter.inRange(purchases, range: range)
    let years = Set(purchases.compactMap { purchase -> Int? in
      guard purchase.purchaseDate.count >= 4 else { return nil }
      return Int(purchase.purchaseDate.prefix(4))
    })

    let bucketKey: (PurchaseRecord) -> String = range == "all"
      ? { $0.analyticsBucket(annual: true) }
      : { $0.analyticsBucket(annual: false) }
    let amountByBucket = groupedAmounts(filtered, key: bucketKey)
    let countByBucket = Dictionary(grouping: filtered, by: bucketKey)
      .mapValues(\.count)
    let buckets = fullTimeBuckets(from: purchases, range: range)

    let trend = buckets.map { bucket in
      TrendPoint(bucket: bucket, amount: amountByBucket[bucket] ?? 0)
    }
    let brandShare = groupedAmounts(filtered, key: { $0.analyticsBrandName })
      .map { BrandShare(brand: $0.key, amount: $0.value) }
      .sorted { $0.amount > $1.amount }
    let categoryShare = groupedAmounts(filtered, key: { $0.analyticsCategoryName })
      .map { CategoryShare(category: $0.key, amount: $0.value) }
      .sorted { $0.amount > $1.amount }
    let frequency = buckets.map { bucket in
      FrequencyPoint(bucket: bucket, count: countByBucket[bucket] ?? 0)
    }
    let wishlistCounts = Dictionary(grouping: wishlistItems, by: \.status)
      .map { WishlistCount(status: $0.key, count: $0.value.count) }
      .sorted { $0.status.rawValue < $1.status.rawValue }

    return AnalyticsData(
      range: range,
      availableYears: years.sorted(by: >),
      trend: trend,
      brandShare: brandShare,
      categoryShare: categoryShare,
      frequency: frequency,
      wishlistCounts: wishlistCounts,
      gearRanking: []
    )
  }

  private static func groupedAmounts(_ purchases: [PurchaseRecord], key: (PurchaseRecord) -> String) -> [String: Double] {
    purchases.reduce(into: [:]) { result, purchase in
      result[key(purchase), default: 0] += purchase.totalPriceCny
    }
  }

  private static func monthBucket(_ rawValue: String) -> String {
    guard rawValue.count >= 7 else { return rawValue }
    return String(rawValue.prefix(7))
  }

  private static func yearBucket(_ rawValue: String) -> String {
    guard rawValue.count >= 4 else { return rawValue }
    return String(rawValue.prefix(4))
  }

  private static func fullTimeBuckets(from purchases: [PurchaseRecord], range: String) -> [String] {
    let calendar = Calendar(identifier: .gregorian)
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM"

    if range != "all", let year = Int(range) {
      return (1...12).compactMap { month in
        DateComponents(calendar: calendar, year: year, month: month, day: 1).date
      }
      .map { formatter.string(from: $0) }
    }

    let purchaseYears = purchases.compactMap { purchase -> Int? in
      guard purchase.purchaseDate.count >= 4 else { return nil }
      return Int(purchase.purchaseDate.prefix(4))
    }
    guard let firstYear = purchaseYears.min() else { return [] }
    let currentYear = calendar.component(.year, from: Date())
    return (firstYear...max(firstYear, currentYear)).map(String.init)
  }

  private static var decoder: JSONDecoder {
    let decoder = JSONDecoder()
    decoder.keyDecodingStrategy = .useDefaultKeys
    return decoder
  }

  private static var encoder: JSONEncoder {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    return encoder
  }
}

private struct LocalAppSnapshot: Codable {
  var version = 1
  var purchases: [PurchaseRecord] = []
  var wishlistItems: [WishlistItem] = []
  var pegboardLayouts: PegboardLayoutStore = .empty

  func localFileImageReferences() -> [String] {
    purchases.compactMap(\.gearItem?.coverImageUrl) + wishlistItems.compactMap(\.imageUrl)
  }

  func replacingFileURLs(_ remappedURLs: [String: String]) -> LocalAppSnapshot {
    guard !remappedURLs.isEmpty else { return self }

    return LocalAppSnapshot(
      version: version,
      purchases: purchases.map { purchase in
        guard let coverImageUrl = purchase.gearItem?.coverImageUrl,
              let newURLString = remappedURLs[coverImageUrl] else {
          return purchase
        }
        return purchase.replacingGearCoverImageURL(newURLString)
      },
      wishlistItems: wishlistItems.map { item in
        guard let imageUrl = item.imageUrl,
              let newURLString = remappedURLs[imageUrl] else {
          return item
        }
        return item.replacingImageURL(newURLString)
      },
      pegboardLayouts: pegboardLayouts
    )
  }
}

private struct LocalBackupManifest: Codable {
  var formatVersion = 2
  let exportedAt: String
  let data: LocalAppSnapshot
  let files: [LocalBackupFile]
}

private struct LocalBackupFile: Codable {
  let originalURLString: String
  let relativePath: String
  var dataBase64: String? = nil
}

private struct LocalBackupAttachment {
  let sourceURL: URL
  let packageFileName: String
  let manifestFile: LocalBackupFile
}

private enum WishlistConversionError: LocalizedError {
  case itemNotFound

  var errorDescription: String? {
    "这条心愿已不存在，无法转为购买记录。"
  }
}

private enum LocalBackupError: LocalizedError {
  case missingManifest

  var errorDescription: String? {
    switch self {
    case .missingManifest:
      "备份包无法读取。"
    }
  }
}

private enum BackupPreviewError: LocalizedError {
  case unsupportedVersion, missingPhotos, invalidData
  var errorDescription: String? {
    switch self {
    case .unsupportedVersion: "这个备份来自不支持的版本，请更新 App 后重试。"
    case .missingPhotos: "备份中的照片不完整，请重新导出备份后再试。"
    case .invalidData: "备份记录无法读取，当前数据未修改。"
    }
  }
}

private extension PurchaseRecord {
  func replacingGearSummary(_ summary: GearSummary) -> PurchaseRecord {
    PurchaseRecord(
      id: id,
      itemNameSnapshot: itemNameSnapshot,
      unitPriceCny: unitPriceCny,
      quantity: quantity,
      totalPriceCny: totalPriceCny,
      itemStatus: itemStatus,
      purchaseDate: purchaseDate,
      statusDate: statusDate,
      consumptionRecords: consumptionRecords,
      channel: channel,
      notes: notes,
      brand: brand,
      category: category,
      gearItem: summary
    )
  }

  func replacingPurchaseDetails(_ input: PurchaseEditInput) -> PurchaseRecord {
    PurchaseRecord(
      id: id,
      itemNameSnapshot: itemNameSnapshot,
      unitPriceCny: input.unitPriceCny,
      quantity: input.quantity,
      totalPriceCny: input.unitPriceCny == unitPriceCny && input.quantity == quantity
        ? totalPriceCny : input.unitPriceCny * Double(input.quantity),
      itemStatus: input.itemStatus,
      purchaseDate: input.purchaseDate,
      statusDate: input.statusDate,
      consumptionRecords: input.consumptionRecords ?? consumptionRecords,
      channel: input.channel,
      notes: input.notes,
      brand: brand,
      category: category,
      gearItem: gearItem
    )
  }

  func replacingGearDetails(
    name: String,
    brand: NamedRef?,
    category: NamedRef,
    modelCode: String?,
    gearID: String,
    coverImageUrl: String?,
    imageKey: String?,
    profileDetails: GearProfileDetails?,
    itemStatus: ItemStatus
  ) -> PurchaseRecord {
    PurchaseRecord(
      id: id,
      itemNameSnapshot: name,
      unitPriceCny: unitPriceCny,
      quantity: quantity,
      totalPriceCny: totalPriceCny,
      itemStatus: itemStatus,
      purchaseDate: purchaseDate,
      statusDate: statusDate,
      consumptionRecords: consumptionRecords,
      channel: channel,
      notes: notes,
      brand: brand,
      category: category,
      gearItem: GearSummary(
        id: gearID,
        catalogEquipmentID: gearItem?.catalogEquipmentID,
        modelCode: modelCode,
        coverImageUrl: coverImageUrl,
        imageKey: imageKey,
        profileDetails: profileDetails
      )
    )
  }

  func replacingGearCoverImageURL(_ newURLString: String) -> PurchaseRecord {
    guard let gearItem else { return self }

    return PurchaseRecord(
      id: id,
      itemNameSnapshot: itemNameSnapshot,
      unitPriceCny: unitPriceCny,
      quantity: quantity,
      totalPriceCny: totalPriceCny,
      itemStatus: itemStatus,
      purchaseDate: purchaseDate,
      statusDate: statusDate,
      consumptionRecords: consumptionRecords,
      channel: channel,
      notes: notes,
      brand: brand,
      category: category,
      gearItem: GearSummary(
        id: gearItem.id,
        catalogEquipmentID: gearItem.catalogEquipmentID,
        modelCode: gearItem.modelCode,
        coverImageUrl: newURLString,
        imageKey: gearItem.imageKey,
        profileDetails: gearItem.profileDetails
      )
    )
  }
}

private extension WishlistItem {
  func replacingImageURL(_ newURLString: String) -> WishlistItem {
    WishlistItem(
      id: id,
      name: name,
      targetPriceCny: targetPriceCny,
      currentSeenPriceCny: currentSeenPriceCny,
      priority: priority,
      status: status,
      sourceUrl: sourceUrl,
      imageUrl: newURLString,
      notes: notes,
      brand: brand,
      category: category,
      priceRecordedAt: priceRecordedAt
    )
  }
}

private extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }
}

private enum LocalGearCategory: String, CaseIterable {
  case shuttle = "羽毛球"
  case racket = "球拍"
  case shoes = "球鞋"
  case other = "其他"

  var name: String { rawValue }

  static func infer(from name: String) -> LocalGearCategory {
    let text = name.lowercased()
    if text.contains("球鞋") || text.contains("shoes") || text.contains("65z") || text.contains("p9200") || text.contains("p8500") {
      return .shoes
    }
    if text.contains("球拍") || text.contains("racket") || text.contains("arcsaber") || text.contains("弓箭") || text.contains("astrox") || text.contains("雷霆") {
      return .racket
    }
    if text.contains("羽毛球") || text.contains("shuttle") || text.contains("rsl") || text.contains("亚狮龙") || text.contains("超牌") {
      return .shuttle
    }
    return .other
  }
}

private enum LocalGearImageMatcher {
  static func imageKey(name: String, brandName: String?, categoryName: String?) -> String? {
    let text = normalize([brandName, name, categoryName].compactMap { $0 }.joined(separator: " "))

    if text.contains("yonex") && (text.contains("arcsaber") || text.contains("弓箭")) && text.contains("11") {
      return "yonex_racket_arcsaber11pro_main_01"
    }
    if text.contains("yonex") && (text.contains("arcsaber") || text.contains("弓箭")) && text.contains("7") {
      return "yonex_racket_arcsaber7pro_main_01"
    }
    if text.contains("astrox") || text.contains("天斧") {
      return "yonex_racket_astrox77pro_main_01"
    }
    if text.contains("victor") && (text.contains("thruster") || text.contains("hammer") || text.contains("铁锤")) {
      return "victor_racket_thruster_hammer_main_01"
    }
    if text.contains("victor") && text.contains("12z") {
      return "victor_racket_drivex12zswj_main_01"
    }
    if text.contains("victor") && text.contains("drivex") {
      return "victor_racket_drivex12_main_01"
    }
    if text.contains("雷霆") || text.contains("leiting") {
      return text.contains("white") || text.contains("白") ? "lining_racket_leiting80white_main_01" : "lining_racket_leiting80black_main_01"
    }
    if text.contains("p9200") {
      return "victor_shoes_p9200tty_main_01"
    }
    if text.contains("p8500") {
      return "victor_shoes_p8500nl_main_01"
    }
    if text.contains("贴地飞行") || text.contains("tiedifeixing") {
      return "lining_shoes_tiedifeixing2max_main_01"
    }
    if text.contains("as50") {
      return "yonex_shuttlecock_as50_main_01"
    }
    if text.contains("as05") {
      return "yonex_shuttlecock_as05_main_01"
    }
    if text.contains("rsl") || text.contains("亚狮龙") {
      if text.contains("10") { return "rsl_shuttlecock_no10_main_01" }
      if text.contains("8") { return "rsl_shuttlecock_no8_main_01" }
      if text.contains("7") { return "rsl_shuttlecock_no7_main_01" }
      if text.contains("6") { return "rsl_shuttlecock_no6_main_01" }
      if text.contains("5") { return "rsl_shuttlecock_no5_main_01" }
      if text.contains("4") { return "rsl_shuttlecock_no4_main_01" }
      if text.contains("3") { return "rsl_shuttlecock_no3_main_01" }
      if text.contains("2") { return "rsl_shuttlecock_no2_main_01" }
      return "rsl_shuttlecock_no1_main_01"
    }
    if text.contains("黄超") { return "chao_shuttlecock_huangchao_main_01" }
    if text.contains("红超") { return "chao_shuttlecock_hongchao_main_01" }
    if text.contains("蓝超") { return "chao_shuttlecock_lanchao_main_01" }
    if text.contains("绿超") { return "chao_shuttlecock_lvchao_main_01" }
    if text.contains("超牌") { return "chao_shuttlecock_huangchao_main_01" }

    return nil
  }

  private static func normalize(_ value: String) -> String {
    value
      .lowercased()
      .replacingOccurrences(of: "-", with: "")
      .replacingOccurrences(of: "_", with: "")
      .replacingOccurrences(of: " ", with: "")
  }
}

private func localCatalogImageKey(name: String, brandName: String?, modelCode: String?, categoryName: String?) -> String? {
  LocalGearCatalog.entry(
    matchingName: name,
    brandName: brandName,
    modelCode: modelCode,
    categoryName: categoryName
  )?.imageKey
}

private func localStableID(prefix: String, value: String) -> String {
  let cleaned = value
    .lowercased()
    .trimmingCharacters(in: .whitespacesAndNewlines)
    .map { character -> Character in
      character.isLetter || character.isNumber ? character : "-"
    }
  let slug = String(cleaned)
    .split(separator: "-")
    .joined(separator: "-")
  return "local-\(prefix)-\(slug.isEmpty ? UUID().uuidString : slug)"
}
