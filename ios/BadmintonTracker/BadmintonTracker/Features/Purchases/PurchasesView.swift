import PhotosUI
import UIKit
import SwiftUI

struct PurchasesView: View {
  @Environment(\.dynamicTypeSize) private var typeSize
  @Environment(\.appReduceMotion) private var reduceMotion
  @Environment(\.appReduceTransparency) private var reduceTransparency
  @State private var wishlistError: String?
  @State private var pendingWishlistIDs: Set<String> = []
  @Environment(AppSession.self) private var session
  @State private var showingEditor = false
  @State private var query = ""
  @State private var category: CatalogCategory = .all
  @State private var selectedCatalogEntry: LocalGearCatalogEntry?
  @State private var catalogNotice: CatalogNotice?

  private var filteredCatalogEntries: [LocalGearCatalogEntry] {
    session.catalogEntries
      .filter { category.matches($0) }
      .filter { entry in
        guard !query.isEmpty else { return true }
        return entry.searchText.localizedCaseInsensitiveContains(query)
      }
      .sorted { left, right in
        if left.popularity == right.popularity {
          return left.name.localizedCompare(right.name) == .orderedAscending
        }
        return left.popularity > right.popularity
      }
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        Picker("分类", selection: $category) {
          ForEach(CatalogCategory.allCases) { category in
            Text(LocalizedStringKey(category.label)).tag(category)
          }
        }
        .adaptivePickerStyle()
        .padding(.horizontal)

        if query.isEmpty && category == .all && !recentCatalogEntries.isEmpty {
          CatalogShelf(
            title: "常买",
            entries: recentCatalogEntries,
            isWishlisted: { session.activeWishlistItem(matching: $0) != nil },
            onPurchase: { selectedCatalogEntry = $0 },
            onWishlist: addToWishlist
          )
        }

        VStack(alignment: .leading, spacing: 10) {
          HStack {
            Text(!query.isEmpty ? "搜索结果" : (category == .all ? "热门装备" : category.label))
              .font(.headline)
            Spacer(minLength: 0)
            Text("\(filteredCatalogEntries.count) 款")
              .font(.subheadline.weight(.semibold))
              .foregroundStyle(.secondary)
          }
          .padding(.horizontal)

          if filteredCatalogEntries.isEmpty {
            EmptyStateView(title: "没有找到装备", message: "试试其他名称或型号，也可以自行添加。",
              systemImage: "magnifyingglass", actionTitle: "添加自定义装备", action: { showingEditor = true })
              .padding(.horizontal)
            Button("清除搜索与筛选") { query = ""; category = .all }
              .frame(maxWidth: .infinity, minHeight: 44)
          }

          LazyVGrid(columns: typeSize >= .xxxLarge ? [GridItem(.flexible())] : [GridItem(.adaptive(minimum: 158), spacing: 14)], spacing: 14) {
            ForEach(filteredCatalogEntries) { entry in
              GearCatalogCard(
                entry: entry,
                isWishlisted: session.activeWishlistItem(matching: entry) != nil,
                onPurchase: { selectedCatalogEntry = entry },
                onWishlist: { addToWishlist(entry) }
              )
            }
          }
          .padding(.horizontal)
        }
      }
      .padding(.top, 8)
      .padding(.bottom, 28)
    }
    .background(Color(.systemGroupedBackground))
    .navigationTitle("装备库")
    .navigationBarTitleDisplayMode(.inline)
    .searchable(text: $query, prompt: "搜索装备库")
    .operationFailure($wishlistError)
    .toolbar {
      ToolbarItem(placement: .topBarLeading) {
        NavigationLink {
          WishlistView()
        } label: {
          Label("心愿", systemImage: "star").labelStyle(.titleAndIcon)
        }
        .accessibilityLabel("心愿")
      }

      ToolbarItem(placement: .topBarTrailing) {
        Button {
          showingEditor = true
        } label: {
          Image(systemName: "plus")
        }
        .accessibilityLabel("自定义装备")
      }
    }
    .sheet(isPresented: $showingEditor) {
      AddPurchaseView()
    }
    .sheet(item: $selectedCatalogEntry) { entry in
      AddPurchaseView(initialCatalogEntry: entry)
    }
    .overlay(alignment: .bottom) {
      if let catalogNotice {
        Label(LocalizedStringKey(catalogNotice.message), systemImage: catalogNotice.systemImage)
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(.primary)
          .padding(.horizontal, 16)
          .padding(.vertical, 12)
          .background(reduceTransparency ? AnyShapeStyle(Color(.secondarySystemBackground)) : AnyShapeStyle(.regularMaterial), in: Capsule())
          .shadow(color: .black.opacity(0.12), radius: 12, y: 5)
          .padding(.bottom, 12)
          .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
          .accessibilityAddTraits(.isStaticText)
      }
    }
  }

  private var recentCatalogEntries: [LocalGearCatalogEntry] {
    var seen: Set<String> = []
    let names = session.gearWallItems.map { item in
      [item.brand?.name, item.modelCode, item.name]
        .compactMap { $0 }
        .joined(separator: " ")
    }

    return names.compactMap { text -> LocalGearCatalogEntry? in
      guard let entry = session.catalogEntries.first(where: { entry in
        let modelCode = entry.modelCode ?? ""
        return text.localizedCaseInsensitiveContains(entry.name)
          || (!modelCode.isEmpty && text.localizedCaseInsensitiveContains(modelCode))
      }) else {
        return nil
      }
      guard !seen.contains(entry.id) else {
        return nil
      }
      seen.insert(entry.id)
      return entry
    }
  }

  private func addToWishlist(_ entry: LocalGearCatalogEntry) {
    guard pendingWishlistIDs.insert(entry.id).inserted else { return }
    Task { @MainActor in
      defer { pendingWishlistIDs.remove(entry.id) }
      let result = await session.addCatalogEntryToWishlist(entry)
      let notice: CatalogNotice
      switch result {
      case .added:
        notice = CatalogNotice(message: "已加入心愿", systemImage: "star.fill")
      case .alreadyExists:
        notice = CatalogNotice(message: "已在心愿中", systemImage: "star.fill")
      case .failed:
        wishlistError = session.errorMessage ?? "暂时无法加入心愿"
        return
      }

      withAnimation(reduceMotion ? nil : .snappy) {
        catalogNotice = notice
      }
      UIAccessibility.post(notification: .announcement, argument: notice.message)
      UINotificationFeedbackGenerator().notificationOccurred(.success)
      try? await Task.sleep(for: .seconds(3))
      guard catalogNotice?.id == notice.id else { return }
      withAnimation(reduceMotion ? nil : .easeOut) {
        catalogNotice = nil
      }
    }
  }
}

private struct CatalogShelf: View {
  @Environment(\.dynamicTypeSize) private var typeSize
  let title: String
  let entries: [LocalGearCatalogEntry]
  let isWishlisted: (LocalGearCatalogEntry) -> Bool
  let onPurchase: (LocalGearCatalogEntry) -> Void
  let onWishlist: (LocalGearCatalogEntry) -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(LocalizedStringKey(title))
        .font(.headline)
        .padding(.horizontal)

      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 12) {
          ForEach(entries) { entry in
            if typeSize.isAccessibilitySize {
              GearCatalogCard(entry: entry, isWishlisted: isWishlisted(entry),
                onPurchase: { onPurchase(entry) }, onWishlist: { onWishlist(entry) })
                .frame(width: 300)
            } else {
            GearCatalogCompactCard(
              entry: entry,
              isWishlisted: isWishlisted(entry),
              onPurchase: { onPurchase(entry) },
              onWishlist: { onWishlist(entry) }
            )
            }
          }
        }
        .padding(.horizontal)
        .padding(.vertical, 2)
      }
    }
  }
}

private struct GearCatalogCompactCard: View {
  let entry: LocalGearCatalogEntry
  let isWishlisted: Bool
  let onPurchase: () -> Void
  let onWishlist: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Button(action: onPurchase) {
        VStack(alignment: .leading, spacing: 8) {
          RemoteImageView(
            url: GearImageResolver.preferredImageURL(imageKey: entry.imageKey, coverImageUrl: nil),
            systemImage: "sportscourt",
            imageKey: entry.imageKey,
            coverImageUrl: nil,
            categoryName: entry.categoryName
          )
          .frame(width: 74, height: 74)

          Text(entry.name)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.primary)
            .lineLimit(2, reservesSpace: true)
            .frame(width: 104, alignment: .topLeading)
        }
      }
      .buttonStyle(.plain)
      .accessibilityLabel("记录购买：\(entry.name)")

      HStack {
        Spacer(minLength: 0)
        CatalogWishlistButton(
          itemName: entry.name,
          isWishlisted: isWishlisted,
          action: onWishlist
        )
      }
    }
    .padding(10)
    .frame(width: 124, alignment: .leading)
    .appSurface(.compact)
  }
}

private struct GearCatalogCard: View {
  @Environment(\.dynamicTypeSize) private var typeSize
  let entry: LocalGearCatalogEntry
  let isWishlisted: Bool
  let onPurchase: () -> Void
  let onWishlist: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Button(action: onPurchase) {
        VStack(alignment: .leading, spacing: 10) {
          RemoteImageView(
            url: GearImageResolver.preferredImageURL(imageKey: entry.imageKey, coverImageUrl: nil),
            systemImage: "sportscourt",
            imageKey: entry.imageKey,
            coverImageUrl: nil,
            categoryName: entry.categoryName
          )
          .aspectRatio(1, contentMode: .fit)
          .frame(maxWidth: .infinity)

          Text(entry.name)
            .font(.subheadline.weight(.bold))
            .foregroundStyle(.primary)
            .lineLimit(2, reservesSpace: true)
            .frame(maxWidth: .infinity, alignment: .topLeading)

          Text(entry.subtitle)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1, reservesSpace: true)
        }
      }
      .buttonStyle(.plain)
      .accessibilityLabel("记录购买：\(entry.name)")

      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(entry.suggestedUnitPriceCny.map { money($0) } ?? " ")
          .font(.subheadline.weight(.bold))
          .foregroundStyle(.primary)
          .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
          .accessibilityHidden(entry.suggestedUnitPriceCny == nil)

        Spacer(minLength: 0)

        CatalogWishlistButton(
          itemName: entry.name,
          isWishlisted: isWishlisted,
          action: onWishlist
        )
      }
    }
    .padding(12)
    .appSurface()
  }
}

private struct CatalogWishlistButton: View {
  let itemName: String
  let isWishlisted: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Image(systemName: isWishlisted ? "star.fill" : "star")
        .font(.subheadline.weight(.medium))
        .foregroundStyle(.secondary)
        .frame(width: 44, height: 44)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(isWishlisted ? "已在心愿中" : "加入心愿：\(itemName)")
    .accessibilityHint(isWishlisted ? "轻点查看收藏状态" : "轻点加入心愿单")
  }
}

private struct CatalogNotice: Identifiable {
  let id = UUID()
  let message: String
  let systemImage: String
}

struct PurchaseRow: View {
  @Environment(AppSession.self) private var session
  let purchase: PurchaseRecord
  @ScaledMetric(relativeTo: .caption) private var statusWidth: CGFloat = 88

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      AdaptiveRow(spacing: 12) {
        RemoteImageView(
          url: GearImageResolver.preferredImageURL(imageKey: purchase.gearItem?.imageKey, coverImageUrl: purchase.gearItem?.coverImageUrl),
          systemImage: "sportscourt",
          imageKey: purchase.gearItem?.imageKey,
          coverImageUrl: purchase.gearItem?.coverImageUrl,
          categoryName: purchase.category?.name
        )
          .frame(width: 48, height: 48)

        VStack(alignment: .leading, spacing: 6) {
          Text(purchase.displayName)
            .font(.headline)
            .foregroundStyle(.primary)
            .fixedSize(horizontal: false, vertical: true)
          Text([purchase.brand?.name, purchase.category.map { AppLanguage.text($0.name) }].compactMap { $0 }.joined(separator: " / "))
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
        }

        Spacer(minLength: 0)

        Text(money(purchase.totalPriceCny))
          .font(.subheadline.weight(.semibold))
      }

      AdaptiveRow(spacing: 8, alignment: .center) {
        StatusPill(
          text: purchase.consumedQuantity > 0 && purchase.remainingQuantity > 0 ? "部分用完" : purchase.inventoryStatusText,
          color: purchase.inventoryTint, systemImage: purchase.inventorySymbol, width: statusWidth
        )
        VStack(alignment: .leading, spacing: 4) {
          Text("数量 \(purchase.quantity) · 购买 \(shortDate(purchase.purchaseDate))")
          if purchase.consumedQuantity > 0 && purchase.remainingQuantity > 0 {
            Text("已用完 \(purchase.consumedQuantity) · 剩余 \(purchase.remainingQuantity)")
          }
          if let statusDateText = purchase.purchaseStatusDateText { Text(statusDateText) }
        }
      }
      .font(.caption)
      .foregroundStyle(.secondary)
    }
    .padding(14)
  }
}

private struct PurchaseGridCard: View {
  @Environment(AppSession.self) private var session
  let purchase: PurchaseRecord

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      RemoteImageView(
        url: GearImageResolver.preferredImageURL(imageKey: purchase.gearItem?.imageKey, coverImageUrl: purchase.gearItem?.coverImageUrl),
        systemImage: "sportscourt",
        imageKey: purchase.gearItem?.imageKey,
        coverImageUrl: purchase.gearItem?.coverImageUrl,
        categoryName: purchase.category?.name
      )
      .aspectRatio(1, contentMode: .fit)

      Text(purchase.displayName)
        .font(.headline)
        .foregroundStyle(.primary)
        .lineLimit(2)
        .frame(minHeight: 42, alignment: .topLeading)

      Text([purchase.brand?.name, purchase.category.map { AppLanguage.text($0.name) }].compactMap { $0 }.joined(separator: " / "))
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)

      HStack(alignment: .firstTextBaseline) {
        Text(money(purchase.totalPriceCny))
          .font(.subheadline.weight(.bold))
        Spacer(minLength: 0)
        Text("x\(purchase.quantity)")
          .font(.caption.weight(.semibold))
          .foregroundStyle(.secondary)
      }

      HStack(spacing: 6) {
        StatusPill(text: purchase.inventoryStatusText, color: purchase.inventoryTint, systemImage: purchase.inventorySymbol)
        Spacer(minLength: 0)
        Text(purchase.purchaseStatusDateText ?? "购买 \(shortDate(purchase.purchaseDate))")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
    .padding(12)
    .appSurface()
  }
}

struct AddPurchaseView: View {
  @Environment(AppSession.self) private var session
  @Environment(\.appReduceMotion) private var reduceMotion
  private let initialCatalogEntry: LocalGearCatalogEntry?
  private let initialWishlistItem: WishlistItem?
  private let initialPurchase: PurchaseRecord?

  @State private var availableDraft: [String]?
  private var draftKey: String { initialPurchase.map { "repeat." + $0.id } ?? initialWishlistItem.map { "wish." + $0.id } ?? initialCatalogEntry.map { "catalog." + $0.id } ?? "custom" }
  @State private var itemName = ""
  @State private var brandName = ""
  @State private var modelCode = ""
  @State private var price = ""
  @State private var quantity = 1
  @State private var channel = ""
  @State private var brandChoice = PurchaseInputChoice.custom
  @State private var modelChoice = PurchaseInputChoice.custom
  @State private var notes = ""
  @State private var category: PurchaseCategoryChoice = .shuttle
  @State private var status: ItemStatus = .inUse
  @State private var purchaseDate = Date()
  @State private var selectedCatalogEntry: LocalGearCatalogEntry?
  @State private var selectedPhoto: PhotosPickerItem?
  @State private var selectedPhotoImage: UIImage?
  @State private var selectedPhotoURLString: String?
  @State private var isProcessingPhoto = false
  @State private var photoRequestID: UUID?
  @State private var photoMessage: String?
  @State private var didApplyInitialData = false
  @State private var showsEquipmentDetails = false
  @State private var ballsPerTube = "12"
  @State private var shuttleSpeed = ""
  @State private var racketWeightSpec = RacketSpecOptions.normalizedWeightSpec(nil)
  @State private var racketGripSpec = RacketSpecOptions.normalizedGripSpec(nil)
  @State private var racketString = ""
  @State private var racketMainTension = ""
  @State private var racketCrossTension = ""
  @State private var racketStringingDate = Date()
  @State private var shoesSize = ""
  @State private var shoesSizeSystem = "EU"
  @State private var shoesColorway = ""
  @State private var completedPurchase: PurchaseSuccess?

  init(
    initialCatalogEntry: LocalGearCatalogEntry? = nil,
    initialWishlistItem: WishlistItem? = nil,
    initialPurchase: PurchaseRecord? = nil
  ) {
    self.initialCatalogEntry = initialCatalogEntry
    self.initialWishlistItem = initialWishlistItem
    self.initialPurchase = initialPurchase
  }

  var body: some View {
    NavigationStack {
      Group {
        if let completedPurchase {
          PurchaseSuccessView(success: completedPurchase)
            .transition(.opacity)
        } else {
          purchaseForm
            .transition(.opacity)
        }
      }
      .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: completedPurchase != nil)
    }
  }

  private var purchaseForm: some View {
    let photoButtonTitle = selectedPhotoImage == nil ? "选择装备照片" : "更换装备照片"

    return Form {
        if let availableDraft {
          Section {
            Button("继续上次未完成的记录") { restoreDraft(availableDraft); self.availableDraft = nil }
            Button("删除草稿", role: .destructive) { PurchaseDraftStore.remove(key: draftKey); self.availableDraft = nil }
              .foregroundStyle(SemanticTint.destructive)
          } footer: { Text("草稿仅保存在这台设备上，保存后才会计入购买记录。") }
        }
        if let initialPurchase {
          Section("再次入手") {
            Label(GearDisplayName.resolve(name: initialPurchase.itemNameSnapshot,
              brand: initialPurchase.brand?.name, model: initialPurchase.gearItem?.modelCode,
              category: initialPurchase.category?.name, imageKey: initialPurchase.gearItem?.imageKey),
              systemImage: "arrow.clockwise")
          }
        }
        if let selectedCatalogEntry {
          Section("装备库") {
            CatalogSelectionSummary(entry: selectedCatalogEntry)
          }
        }

        if selectedCatalogEntry != nil || initialPurchase != nil {
          purchaseSection
          Section {
            Toggle("编辑装备资料与规格", isOn: $showsEquipmentDetails)
          }
        }

        if (selectedCatalogEntry == nil && initialPurchase == nil) || showsEquipmentDetails {
        Section("装备") {
          TextField("名称", text: $itemName)

          Picker("品牌", selection: Binding(get: { brandChoice }, set: applyBrandChoice)) {
            ForEach(brandOptions, id: \.self) { option in
              Text(option).tag(option)
            }
            Text("手动输入").tag(PurchaseInputChoice.custom)
          }

          if brandChoice == PurchaseInputChoice.custom {
            TextField("品牌名称", text: $brandName)
          }

          if !modelOptions.isEmpty {
            Picker("型号", selection: Binding(get: { modelChoice }, set: applyModelChoice)) {
              ForEach(modelOptions) { entry in
                Text(entry.modelCode ?? entry.name).tag(entry.id)
              }
              Text("手动输入").tag(PurchaseInputChoice.custom)
            }
          }

          if modelOptions.isEmpty || modelChoice == PurchaseInputChoice.custom {
            TextField("型号", text: $modelCode)
          }

          Picker("分类", selection: $category) {
            ForEach(PurchaseCategoryChoice.allCases) { item in
              Text(item.title).tag(item)
            }
          }
          Picker("状态", selection: $status) {
            ForEach(ItemStatus.allCases) { item in
              Text(LocalizedStringKey(item.label)).tag(item)
            }
          }
        }

        profileSection

        }
        if selectedCatalogEntry == nil && initialPurchase == nil { purchaseSection }

        Section("照片") {
          PhotosPicker(selection: $selectedPhoto, matching: .images) {
            Label(photoButtonTitle, systemImage: "photo")
          }
          .disabled(isProcessingPhoto)

          if let selectedPhotoImage {
            GearPhotoPreview(image: selectedPhotoImage, reference: selectedPhotoURLString, isProcessing: isProcessingPhoto)
          }

          if !isProcessingPhoto, let photoMessage {
            Text(photoMessage)
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
        }



        Section("备注") {
          TextField("可选", text: $notes, axis: .vertical)
            .lineLimit(3...5)
        }
      }
      .navigationTitle(initialPurchase != nil ? "再买一次" : initialWishlistItem == nil ? "记录购买" : "入手心愿")
      .navigationBarTitleDisplayMode(.inline)
      .onAppear {
        guard !didApplyInitialData else { return }
        availableDraft = PurchaseDraftStore.load(key: draftKey)
        didApplyInitialData = true
        if let initialPurchase {
          applyRepeatPurchase(initialPurchase)
        } else if let initialWishlistItem {
          applyWishlistItem(initialWishlistItem)
        } else if let initialCatalogEntry {
          applyCatalogEntry(initialCatalogEntry)
        }
      }
      .task(id: selectedPhoto) { await handlePhotoSelection(selectedPhoto) }
      .onChange(of: brandName) { _, _ in refreshModelChoice() }
      .onChange(of: category) { _, _ in refreshModelChoice() }
      .editorActions(title: initialWishlistItem == nil ? "保存" : "确认入手",
        isValid: !itemName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && validPrice && (1...9999).contains(quantity),
        isBusy: isProcessingPhoto, draft: editorDraft, ready: didApplyInitialData, draftKey: draftKey,
        onSaved: showSuccess, save: save)
  }

  private func restoreDraft(_ values: [String]) {
    guard values.count == 22 else { return }
    if let restored = PurchaseCategoryChoice(rawValue: values[7]) { category = restored }
    itemName = values[0]; brandName = values[1]; modelCode = values[2]; price = values[3]
    quantity = Int(values[4]) ?? 1; channel = values[5]; notes = values[6]
    status = ItemStatus(rawValue: values[8]) ?? .inUse
    purchaseDate = Date(timeIntervalSince1970: Double(values[9]) ?? Date().timeIntervalSince1970)
    selectedPhotoURLString = values[10].isEmpty ? nil : values[10]
    selectedPhotoImage = GearImageResolver.localImage(imageKey: nil, coverImageUrl: selectedPhotoURLString)
    ballsPerTube = values[11]; shuttleSpeed = values[12]; racketWeightSpec = values[13]
    racketGripSpec = values[14]; racketString = values[15]; racketMainTension = values[16]
    racketCrossTension = values[17]
    racketStringingDate = Date(timeIntervalSince1970: Double(values[18]) ?? Date().timeIntervalSince1970)
    shoesSize = values[19]; shoesSizeSystem = values[20]; shoesColorway = values[21]
    restoreEquipmentChoices()
  }

  private var validPrice: Bool {
    guard let value = Double(price) else { return false }
    return value.isFinite && value >= 0
  }

  private var editorDraft: [String] {
    [itemName, brandName, modelCode, price, String(quantity), channel, notes, category.rawValue,
     status.rawValue, String(purchaseDate.timeIntervalSince1970), selectedPhotoURLString ?? "",
     ballsPerTube, shuttleSpeed, racketWeightSpec, racketGripSpec, racketString,
     racketMainTension, racketCrossTension, String(racketStringingDate.timeIntervalSince1970),
     shoesSize, shoesSizeSystem, shoesColorway]
  }

  private var purchaseSection: some View {
    Section {
      LabeledInput(title: "实付单价", text: $price, prompt: "0.00", keyboard: .decimalPad, unit: "元")
      QuantityInput(value: $quantity)
      if validPrice {
        LabeledContent("合计", value: money((Double(price) ?? 0) * Double(quantity)))
          .fontWeight(.semibold)
      }
      DatePicker("购买日期", selection: $purchaseDate, displayedComponents: .date)
      PurchaseChannelSelectionField(channel: $channel)
    } header: {
      Text("购买")
    } footer: {
      if !price.isEmpty && !validPrice {
        Text("请输入不小于 0 的有效金额。").foregroundStyle(.red)
      } else if initialPurchase != nil {
        Text("已带入上次单价，请按本次实付金额确认。")
      } else if selectedCatalogEntry != nil {
        Text("已预填参考单价，请按实际支付金额修改。")
      }
    }
  }

  @MainActor
  private func handlePhotoSelection(_ item: PhotosPickerItem?) async {
    guard let item else { return }
    let requestID = UUID()
    photoRequestID = requestID
    let previousImage = selectedPhotoImage
    let previousReference = selectedPhotoURLString
    isProcessingPhoto = true
    photoMessage = nil
    defer { if photoRequestID == requestID { isProcessingPhoto = false } }
    do {
      guard let data = try await item.loadTransferable(type: Data.self),
            let image = UIImage(data: data) else { throw CocoaError(.fileReadCorruptFile) }
      try Task.checkCancellation()
      guard photoRequestID == requestID else { return }
      selectedPhotoImage = image
      selectedPhotoURLString = nil
      let result = try await GearPhotoProcessor.processImportedImage(image, categoryName: category.title)
      guard !Task.isCancelled, photoRequestID == requestID else {
        try? GearPhotoProcessor.deleteMedia(id: result.mediaID)
        return
      }
      selectedPhotoURLString = result.displayReference
      selectedPhotoImage = UIImage(contentsOfFile: result.displayURL.path) ?? image
      if result.cutoutURL == nil { photoMessage = "未识别到清晰主体，已保留原图。" }
    } catch {
      guard !Task.isCancelled, photoRequestID == requestID else { return }
      selectedPhotoImage = previousImage
      selectedPhotoURLString = previousReference
      photoMessage = "照片处理失败，请重新选择。"
    }
  }

  private var purchaseInput: PurchaseInput {
    let unitPrice = Double(price) ?? 0
    return PurchaseInput(
      catalogEquipmentID: selectedCatalogEntry?.catalogEquipmentID ?? (repeatsSameGear ? initialPurchase?.gearItem?.catalogEquipmentID : nil),
      brandName: LocalBrandNormalizer.canonicalName(brandName),
      modelCode: modelCode.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
      categoryId: category.rawValue,
      categoryName: category.title,
      gearCoverImageUrl: selectedPhotoURLString,
      gearImageKey: selectedCatalogEntry?.imageKey ?? (repeatsSameGear ? initialPurchase?.gearItem?.imageKey : nil),
      profileDetails: profileDetailsForCurrentCategory(),
      itemNameSnapshot: itemName.trimmingCharacters(in: .whitespacesAndNewlines),
      unitPriceCny: unitPrice,
      quantity: quantity,
      totalPriceCny: unitPrice * Double(quantity),
      purchaseDate: ISO8601DateFormatter().string(from: purchaseDate),
      channel: PurchaseChannelOptions.normalizedChannel(channel),
      itemStatus: status,
      notes: notes.isEmpty ? nil : notes,
      receiptImageUrl: nil
    )
  }

  private var repeatsSameGear: Bool {
    guard let initialPurchase else { return false }
    return LocalGearIdentity.id(name: itemName, brandName: brandName, modelCode: modelCode, categoryName: category.title)
      == LocalGearIdentity.id(for: initialPurchase)
  }

  private func save() async -> Bool {
    if let initialWishlistItem {
      return await session.purchaseWishlistItem(id: initialWishlistItem.id, purchaseInput: purchaseInput)
    } else {
      return await session.createPurchase(purchaseInput)
    }
  }

  private func showSuccess() {
    let input = purchaseInput
    let identity = LocalGearIdentity.id(name: input.itemNameSnapshot, brandName: input.brandName,
      modelCode: input.modelCode, categoryName: input.categoryName, entries: session.catalogEntries)
    let matchingPurchases = session.purchases.filter { purchase in
      if let catalogEquipmentID = input.catalogEquipmentID {
        return purchase.gearItem?.catalogEquipmentID == catalogEquipmentID
      }
      return LocalGearIdentity.id(for: purchase, entries: session.catalogEntries) == identity
    }
    let kind: PurchaseSuccess.Kind
    if initialWishlistItem != nil { kind = .wishlist }
    else if session.purchases.count == 1 { kind = .firstGear }
    else if matchingPurchases.count > 1 { kind = .repeatPurchase }
    else { kind = .newGear }
    completedPurchase = PurchaseSuccess(purchase: input, kind: kind)
  }

  private var recentCatalogEntries: [LocalGearCatalogEntry] {
    var seen: Set<String> = []
    let names = session.gearWallItems.map { item in
      [item.brand?.name, item.modelCode, item.name]
        .compactMap { $0 }
        .joined(separator: " ")
    }

    return names.compactMap { text -> LocalGearCatalogEntry? in
      guard let entry = session.catalogEntries.first(where: { entry in
        let modelCode = entry.modelCode ?? ""
        return text.localizedCaseInsensitiveContains(entry.name)
          || (!modelCode.isEmpty && text.localizedCaseInsensitiveContains(modelCode))
      }) else {
        return nil
      }
      guard !seen.contains(entry.id) else {
        return nil
      }
      seen.insert(entry.id)
      return entry
    }
  }

  private var brandOptions: [String] {
    LocalGearCatalog.brandOptions(categoryName: nil, entries: session.catalogEntries)
  }

  private var modelOptions: [LocalGearCatalogEntry] {
    LocalGearCatalog.modelOptions(
      brandName: brandName,
      categoryName: category.title,
      entries: session.catalogEntries
    )
  }

  private func applyBrandChoice(_ value: String) {
    brandChoice = value
    if value != PurchaseInputChoice.custom { brandName = value }
    refreshModelChoice()
  }

  private func applyModelChoice(_ value: String) {
    if value == PurchaseInputChoice.custom {
      if modelChoice != PurchaseInputChoice.custom { modelCode = "" }
      modelChoice = PurchaseInputChoice.custom
      selectedCatalogEntry = nil
      return
    }
    guard let entry = modelOptions.first(where: { $0.id == value }) else { return }
    applyCatalogEntry(entry)
  }

  private func refreshModelChoice() {
    // A missing model never invalidates a brand. Only detach a stale catalog model.
    if modelChoice != PurchaseInputChoice.custom, !modelOptions.contains(where: { $0.id == modelChoice }) {
      modelChoice = PurchaseInputChoice.custom
      modelCode = ""
      selectedCatalogEntry = nil
    }
    if let entry = selectedCatalogEntry,
       entry.brandName != LocalBrandNormalizer.canonicalName(brandName) || entry.categoryName != category.title {
      selectedCatalogEntry = nil
    }
  }

  private func restoreEquipmentChoices() {
    let selection = PurchaseCatalogSelection(brandName: brandName, modelCode: modelCode,
      categoryName: category.title, entries: session.catalogEntries)
    brandName = selection.brandName
    brandChoice = selection.brandChoice
    modelChoice = selection.modelChoice
    if selectedCatalogEntry?.id != selection.modelChoice { selectedCatalogEntry = nil }
  }

  private func applyCatalogEntry(_ entry: LocalGearCatalogEntry) {
    selectedCatalogEntry = entry
    itemName = entry.name
    brandName = entry.brandName
    modelCode = entry.modelCode ?? ""
    category = PurchaseCategoryChoice(categoryName: entry.categoryName)
    brandChoice = entry.brandName
    modelChoice = entry.id
    if let suggestedUnitPriceCny = entry.suggestedUnitPriceCny {
      price = suggestedUnitPriceCny.formatted(.number.grouping(.never).precision(.fractionLength(0...2)).locale(Locale(identifier: "en_US_POSIX")))
    }
    racketWeightSpec = RacketSpecOptions.normalizedWeightSpec(racketWeightSpec)
    racketGripSpec = RacketSpecOptions.normalizedGripSpec(racketGripSpec)
    selectedPhoto = nil
    selectedPhotoImage = nil
    selectedPhotoURLString = nil
    photoMessage = nil
  }

  private func applyWishlistItem(_ item: WishlistItem) {
    if let entry = LocalGearCatalog.entry(matching: item, entries: session.catalogEntries) {
      applyCatalogEntry(entry)
    } else {
      selectedCatalogEntry = nil
      category = PurchaseCategoryChoice(categoryName: item.category?.name ?? "其他")
      brandName = item.brand?.name ?? ""
      modelChoice = PurchaseInputChoice.custom
    }

    itemName = item.name
    if let itemBrand = item.brand?.name {
      brandName = itemBrand
    }
    if let purchasePrice = item.currentSeenPriceCny ?? item.targetPriceCny {
      price = purchasePrice.formatted(.number.grouping(.never).precision(.fractionLength(0...2)).locale(Locale(identifier: "en_US_POSIX")))
    }
    notes = item.notes ?? ""
    selectedPhotoURLString = item.imageUrl
    restoreEquipmentChoices()
  }

  private func applyRepeatPurchase(_ purchase: PurchaseRecord) {
    let input = purchase.repeatPurchaseInput()
    itemName = input.itemNameSnapshot
    brandName = input.brandName ?? ""
    modelCode = input.modelCode ?? ""
    category = PurchaseCategoryChoice(categoryName: input.categoryName ?? "其他")
    price = input.unitPriceCny.formatted(.number.grouping(.never).precision(.fractionLength(0...2)).locale(Locale(identifier: "en_US_POSIX")))
    channel = input.channel ?? ""
    selectedPhotoURLString = input.gearCoverImageUrl
    selectedPhotoImage = GearImageResolver.localImage(imageKey: input.gearImageKey, coverImageUrl: input.gearCoverImageUrl)
    switch input.profileDetails {
    case .shuttle(let details):
      ballsPerTube = details.ballsPerTube.map(String.init) ?? "12"
      shuttleSpeed = details.speed ?? ""
    case .racket(let details):
      racketWeightSpec = RacketSpecOptions.normalizedWeightSpec(details.weightSpec)
      racketGripSpec = RacketSpecOptions.normalizedGripSpec(details.gripSpec)
    case .shoes(let details):
      shoesSize = details.size ?? ""; shoesSizeSystem = details.sizeSystem ?? "EU"; shoesColorway = details.colorway ?? ""
    default: break
    }
    restoreEquipmentChoices()
  }

  @ViewBuilder
  private var profileSection: some View {
    switch category {
    case .shuttle:
      Section("羽毛球规格") {
        LabeledInput(title: "每筒数量", text: $ballsPerTube, prompt: "12", keyboard: .numberPad, unit: "只")
        LabeledInput(title: "速度号", text: $shuttleSpeed)
      }
    case .racket:
      Section("球拍规格") {
        Picker("重量规格", selection: $racketWeightSpec) {
          ForEach(RacketSpecOptions.weightSpecs, id: \.self) { option in
            Text(option).tag(option)
          }
        }
        Picker("手柄规格", selection: $racketGripSpec) {
          ForEach(RacketSpecOptions.gripSpecs, id: \.self) { option in
            Text(option).tag(option)
          }
        }
      }

      Section("初始穿线") {
        RacketStringSelectionField(stringName: $racketString)
        LabeledInput(title: "主线磅数", text: $racketMainTension, keyboard: .decimalPad, unit: "lb")
        LabeledInput(title: "横线磅数", text: $racketCrossTension, keyboard: .decimalPad, unit: "lb")
        DatePicker("穿线日期", selection: $racketStringingDate, displayedComponents: .date)
      }
    case .shoes:
      Section("球鞋规格") {
        LabeledInput(title: "尺码", text: $shoesSize)
        Picker("尺码体系", selection: $shoesSizeSystem) {
          ForEach(["EU", "JP", "CN", "US"], id: \.self) { option in
            Text(option).tag(option)
          }
        }
        LabeledInput(title: "配色", text: $shoesColorway)
      }
    case .other:
      EmptyView()
    }
  }

  private func profileDetailsForCurrentCategory() -> GearProfileDetails? {
    switch category {
    case .shuttle:
      return .shuttle(ShuttleGearDetails(
        ballsPerTube: Int(ballsPerTube.trimmingCharacters(in: .whitespacesAndNewlines)),
        speed: shuttleSpeed.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
      ))
    case .racket:
      let stringName = RacketStringOptions.normalizedStringName(racketString)
      let mainTension = Double(racketMainTension)
      let crossTension = Double(racketCrossTension)
      let stringingDate = ISO8601DateFormatter().string(from: racketStringingDate)
      var details = RacketGearDetails(
        weightSpec: RacketSpecOptions.normalizedWeightSpec(racketWeightSpec),
        gripSpec: RacketSpecOptions.normalizedGripSpec(racketGripSpec)
      )
      if repeatsSameGear, case .racket(var previous) = initialPurchase?.gearItem?.profileDetails {
        previous.weightSpec = details.weightSpec
        previous.gripSpec = details.gripSpec
        details = previous
      }
      if stringName != nil || mainTension != nil || crossTension != nil {
        details = details.appendingStringingRecord(StringingRecord(
          id: UUID(),
          stringName: stringName,
          mainTension: mainTension,
          crossTension: crossTension,
          stringingDate: stringingDate,
          notes: nil
        ))
      }
      return .racket(details)
    case .shoes:
      return .shoes(ShoesGearDetails(
        size: shoesSize.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
        sizeSystem: shoesSizeSystem.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
        colorway: shoesColorway.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
      ))
    case .other:
      return nil
    }
  }
}

private struct CatalogSelectionSummary: View {
  let entry: LocalGearCatalogEntry

  var body: some View {
    HStack(spacing: 12) {
      RemoteImageView(
        url: GearImageResolver.preferredImageURL(imageKey: entry.imageKey, coverImageUrl: nil),
        systemImage: "sportscourt",
        imageKey: entry.imageKey,
        coverImageUrl: nil,
        categoryName: entry.categoryName
      )
      .frame(width: 48, height: 48)

      VStack(alignment: .leading, spacing: 4) {
        Text(entry.name)
          .font(.body.weight(.medium))
        Text(entry.subtitle)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
  }
}

private struct GearCatalogPickerView: View {
  let recentItems: [LocalGearCatalogEntry]
  let onSelect: (LocalGearCatalogEntry) -> Void

  @Environment(\.dismiss) private var dismiss
  @Environment(AppSession.self) private var session
  @State private var query = ""
  @State private var category: CatalogCategory = .all

  private var filteredItems: [LocalGearCatalogEntry] {
    session.catalogEntries
      .filter { category.matches($0) }
      .filter { entry in
        guard !query.isEmpty else { return true }
        return entry.searchText.localizedCaseInsensitiveContains(query)
      }
  }

  var body: some View {
    NavigationStack {
      List {
        if query.isEmpty && category == .all && !recentItems.isEmpty {
          Section("常买") {
            ForEach(recentItems) { entry in
              GearCatalogRow(entry: entry) {
                onSelect(entry)
                dismiss()
              }
            }
          }
        }

        Section("装备库") {
          Picker("分类", selection: $category) {
            ForEach(CatalogCategory.allCases) { category in
              Text(LocalizedStringKey(category.label)).tag(category)
            }
          }
          .adaptivePickerStyle()
          .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))

          ForEach(filteredItems) { entry in
            GearCatalogRow(entry: entry) {
              onSelect(entry)
              dismiss()
            }
          }
        }
      }
      .navigationTitle("装备库")
      .navigationBarTitleDisplayMode(.inline)
      .searchable(text: $query, prompt: "搜索装备、品牌或型号")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("取消") { dismiss() }
        }
      }
    }
  }
}

private struct GearCatalogRow: View {
  let entry: LocalGearCatalogEntry
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 12) {
        RemoteImageView(
          url: GearImageResolver.preferredImageURL(imageKey: entry.imageKey, coverImageUrl: nil),
          systemImage: "sportscourt",
          imageKey: entry.imageKey,
          coverImageUrl: nil,
          categoryName: entry.categoryName
        )
        .frame(width: 52, height: 52)

        VStack(alignment: .leading, spacing: 4) {
          Text(entry.name)
            .font(.body.weight(.medium))
            .foregroundStyle(.primary)
            .lineLimit(2)
          Text(entry.subtitle)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
          if let suggestedUnitPriceCny = entry.suggestedUnitPriceCny {
            Text(money(suggestedUnitPriceCny))
              .font(.caption.weight(.semibold))
              .foregroundStyle(.secondary)
          }
        }

        Spacer(minLength: 0)
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}

private enum CatalogCategory: String, CaseIterable, Identifiable {
  case all
  case shuttle
  case shoes
  case racket
  case other

  var id: String { rawValue }

  var label: String {
    switch self {
    case .all:
      "全部"
    case .shuttle:
      "羽毛球"
    case .shoes:
      "球鞋"
    case .racket:
      "球拍"
    case .other:
      "其他"
    }
  }

  func matches(_ entry: LocalGearCatalogEntry) -> Bool {
    switch self {
    case .all:
      true
    case .shuttle:
      entry.categoryName == "羽毛球"
    case .shoes:
      entry.categoryName == "球鞋"
    case .racket:
      entry.categoryName == "球拍"
    case .other:
      !["羽毛球", "球鞋", "球拍"].contains(entry.categoryName)
    }
  }
}

private enum PurchaseCategoryChoice: String, CaseIterable, Identifiable {
  case shuttle
  case racket
  case shoes
  case other

  var id: String { rawValue }

  var title: String {
    switch self {
    case .shuttle:
      "羽毛球"
    case .racket:
      "球拍"
    case .shoes:
      "球鞋"
    case .other:
      "其他"
    }
  }

  init(categoryName: String) {
    switch categoryName {
    case "羽毛球":
      self = .shuttle
    case "球拍":
      self = .racket
    case "球鞋":
      self = .shoes
    default:
      self = .other
    }
  }
}

enum PurchaseInputChoice {
  static let custom = "__custom__"
}

/// Resolve saved form values without requiring the brand to have a catalog model
/// in this category, and without replacing the user's price or custom model text.
struct PurchaseCatalogSelection {
  let brandName: String
  let brandChoice: String
  let modelChoice: String

  init(brandName: String, modelCode: String, categoryName: String, entries: [LocalGearCatalogEntry]) {
    let canonicalBrand = LocalBrandNormalizer.canonicalName(brandName) ?? ""
    self.brandName = canonicalBrand
    brandChoice = LocalGearCatalog.brandOptions(categoryName: nil, entries: entries).contains(canonicalBrand)
      ? canonicalBrand : PurchaseInputChoice.custom
    let model = modelCode.trimmingCharacters(in: .whitespacesAndNewlines)
    let match = canonicalBrand.isEmpty || model.isEmpty ? nil
      : LocalGearCatalog.modelOptions(brandName: canonicalBrand, categoryName: categoryName, entries: entries)
        .first { $0.modelCode?.caseInsensitiveCompare(model) == .orderedSame }
    modelChoice = match?.id ?? PurchaseInputChoice.custom
  }
}

private extension String {
  var nilIfEmpty: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}

private extension PurchaseRecord {
  var purchaseStatusDateText: String? {
    guard itemStatus.needsStatusDate, let statusDate else { return nil }
    return "\(itemStatus.statusDateLabel) \(shortDate(statusDate))"
  }
}

private extension ItemStatus {
  var needsStatusDate: Bool {
    self == .usedUp || self == .wornOut
  }

  var statusDateLabel: String {
    switch self {
    case .usedUp:
      "用完日期"
    case .wornOut:
      "退役日期"
    case .inUse, .stored:
      "状态日期"
    }
  }
}
