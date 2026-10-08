import SwiftUI

struct WishlistView: View {
  @State private var deleteCandidate: WishlistItem?
  @State private var actionError: String?
  @State private var isDeleting = false
  @Environment(AppSession.self) private var session
  @State private var presentedSheet: WishlistSheet?
  @State private var filter: WishlistFilter = .all
  @State private var sort: WishlistSort = .priority

  private var displayedItems: [WishlistItem] {
    session.wishlistItems
      .filter(filter.matches)
      .sorted(by: sort.areInIncreasingOrder)
  }

  var body: some View {
    List {
      Section {
        Picker("筛选", selection: $filter) {
          ForEach(WishlistFilter.allCases) { option in
            Text(LocalizedStringKey(option.label)).tag(option)
          }
        }
        .adaptivePickerStyle()
        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
      }

      if displayedItems.isEmpty {
        EmptyStateView(
          title: filter == .all ? "心愿单是空的" : "没有符合条件的心愿",
          message: filter == .all ? "从装备库收藏想买的装备，或手动添加一条心愿。" : "切换筛选条件查看其他心愿。",
          systemImage: "star", actionTitle: filter == .all ? "添加心愿" : "查看全部",
          action: { if filter == .all { presentedSheet = .newItem } else { filter = .all } }
        )
        .listRowBackground(Color.clear)
      } else {
        Section {
          ForEach(displayedItems) { item in
            Button {
              presentedSheet = .edit(item)
            } label: {
              WishlistRow(item: item)
            }
            .buttonStyle(.plain)
            .contentShape(Rectangle())
            .accessibilityHint("打开心愿编辑")
            .swipeActions(edge: .leading, allowsFullSwipe: false) {
              if item.status.isActive {
                Button {
                  presentedSheet = .purchase(item)
                } label: {
                  Label("入手", systemImage: "bag.badge.plus")
                }
                .tint(.blue)
              }
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
              Button(role: .destructive) {
                deleteCandidate = item
              } label: {
                Label("删除", systemImage: "trash")
              }
            }
          }
        } header: {
          Text("\(displayedItems.count) 件")
        }
      }
    }
    .disabled(isDeleting)
    .operationFailure($actionError)
    .confirmationDialog("删除这条心愿？", isPresented: Binding(get: { deleteCandidate != nil }, set: { if !$0 { deleteCandidate = nil } }), titleVisibility: .visible) {
      Button("删除", role: .destructive) {
        guard let item = deleteCandidate else { return }
        isDeleting = true
        Task {
          defer { isDeleting = false; deleteCandidate = nil }
          if !(await session.deleteWishlistItem(id: item.id)) { actionError = session.errorMessage }
        }
      }
    } message: { Text("不会删除已关联的购买记录。删除后可在底部撤销。") }
    .listStyle(.insetGrouped)
    .navigationTitle("心愿")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItemGroup(placement: .topBarTrailing) {
        Menu {
          Picker("排序", selection: $sort) {
            ForEach(WishlistSort.allCases) { option in
              Label(option.label, systemImage: option.systemImage).tag(option)
            }
          }
        } label: {
          Image(systemName: "arrow.up.arrow.down")
        }
        .accessibilityLabel("心愿排序")

        Button {
          presentedSheet = .newItem
        } label: {
          Image(systemName: "plus")
        }
        .accessibilityLabel("新增心愿")
      }
    }
    .sheet(item: $presentedSheet) { destination in
      switch destination {
      case .newItem:
        WishlistEditView(item: nil)
      case .edit(let item):
        WishlistEditView(item: item)
      case .purchase(let item):
        AddPurchaseView(initialWishlistItem: item)
      }
    }
  }
}

private struct WishlistRow: View {
  @Environment(AppSession.self) private var session
  let item: WishlistItem

  private var catalogEntry: LocalGearCatalogEntry? {
    LocalGearCatalog.entry(matching: item, entries: session.catalogEntries)
  }

  private var priceDifference: Double? {
    guard let current = item.currentSeenPriceCny,
          let target = item.targetPriceCny else {
      return nil
    }
    return current - target
  }

  var body: some View {
    AdaptiveRow(spacing: 12) {
      RemoteImageView(
        url: GearImageResolver.preferredImageURL(
          imageKey: catalogEntry?.imageKey,
          coverImageUrl: item.imageUrl
        ),
        systemImage: "sportscourt",
        imageKey: catalogEntry?.imageKey,
        coverImageUrl: item.imageUrl,
        categoryName: item.category?.name
      )
      .frame(width: 64, height: 64)

      VStack(alignment: .leading, spacing: 7) {
        AdaptiveRow {
          Text(item.name)
            .font(.headline)
            .foregroundStyle(.primary)
            .fixedSize(horizontal: false, vertical: true)

          Spacer(minLength: 8)

          if let targetPrice = item.targetPriceCny {
            Text(money(targetPrice))
              .font(.subheadline.weight(.semibold))
              .foregroundStyle(.primary)
          }
        }

        let subtitle = [item.brand?.name, item.category?.name].compactMap { $0 }.joined(separator: " / ")
        if !subtitle.isEmpty {
          Text(LocalizedStringKey(subtitle))
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
        }

        if let currentPrice = item.currentSeenPriceCny {
          AdaptiveRow(spacing: 6) {
            Text("记录价格 \(money(currentPrice))")
            if let priceDifference {
              Text(priceDifference <= 0 ? "已到目标价" : "距目标 \(money(priceDifference))")
                .foregroundStyle(priceDifference <= 0 ? .green : .secondary)
            }
          }
          .font(.caption)
          .foregroundStyle(.secondary)
        }

        if let recordedAt = item.priceRecordedAt {
          Text("价格记录于 \(shortDate(recordedAt))").font(.caption).foregroundStyle(.secondary)
        }
        AdaptiveRow(spacing: 8) {
          StatusPill(text: AppLanguage.text(item.status.label))
          Label(LocalizedStringKey(WishlistPriority.label(for: item.priority)), systemImage: "flag.fill")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
    }
    .padding(.vertical, 5)
    .accessibilityElement(children: .combine)
  }
}

private struct WishlistEditView: View {
  @State private var actionError: String?
  @State private var isPerformingAction = false
  @State private var confirmingDelete = false

  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  let item: WishlistItem?

  @State private var name: String
  @State private var brandName: String
  @State private var categoryName: String
  @State private var targetPrice: String
  @State private var currentPrice: String
  @State private var priority: Int
  @State private var status: WishlistStatus
  @State private var sourceUrl: String
  @State private var imageUrl: String
  @State private var notes: String
  @State private var purchasingItem: WishlistItem?

  init(item: WishlistItem?) {
    self.item = item
    _name = State(initialValue: item?.name ?? "")
    _brandName = State(initialValue: item?.brand?.name ?? "")
    _categoryName = State(initialValue: item?.category?.name ?? "")
    _targetPrice = State(initialValue: item?.targetPriceCny.map(Self.formatPrice) ?? "")
    _currentPrice = State(initialValue: item?.currentSeenPriceCny.map(Self.formatPrice) ?? "")
    _priority = State(initialValue: item?.priority ?? 3)
    _status = State(initialValue: item?.status ?? .want)
    _sourceUrl = State(initialValue: item?.sourceUrl ?? "")
    _imageUrl = State(initialValue: item?.imageUrl ?? "")
    _notes = State(initialValue: item?.notes ?? "")
  }

  var body: some View {
    NavigationStack {
      Form {
        Section("装备") {
          TextField("名称", text: $name)
          TextField("品牌", text: $brandName)
          TextField("分类", text: $categoryName)
        }

        Section {
          LabeledInput(title: "目标价", text: $targetPrice, keyboard: .decimalPad, unit: "元")
          LabeledInput(title: "记录价格", text: $currentPrice, keyboard: .decimalPad, unit: "元")
        } header: { Text("价格") } footer: { Text("价格由你手动记录，并非实时行情。") }

        Section("状态") {
          Picker("状态", selection: $status) {
            ForEach(WishlistStatus.allCases) { option in
              Text(LocalizedStringKey(option.label)).tag(option)
            }
          }
          Picker("优先级", selection: $priority) {
            ForEach((1...5).reversed(), id: \.self) { value in
              Text(LocalizedStringKey(WishlistPriority.label(for: value))).tag(value)
            }
          }
        }

        Section("来源") {
          TextField("购买链接", text: $sourceUrl)
            .keyboardType(.URL)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
          TextField("图片链接", text: $imageUrl)
            .keyboardType(.URL)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()

          if let sourceURL = webURL(from: sourceUrl) {
            Link(destination: sourceURL) {
              Label("打开购买链接", systemImage: "safari")
            }
          }

          if let previewURL = GearImageResolver.preferredImageURL(imageKey: nil, coverImageUrl: imageUrl.nilIfEmpty) {
            RemoteImageView(
              url: previewURL,
              systemImage: "photo",
              coverImageUrl: imageUrl.nilIfEmpty,
              categoryName: categoryName.nilIfEmpty
            )
            .frame(maxWidth: .infinity, minHeight: 140, maxHeight: 200)
            .padding(.vertical, 4)
          }
        }

        Section("备注") {
          TextField("可选", text: $notes, axis: .vertical)
            .lineLimit(3...5)
        }

        if let item, status.isActive {
          Section {
            Button {
              isPerformingAction = true
              Task { @MainActor in
                defer { isPerformingAction = false }
                guard await save() else { actionError = session.errorMessage; return }
                purchasingItem = session.wishlistItems.first(where: { $0.id == item.id }) ?? item
              }
            } label: {
              Label("记录购买", systemImage: "bag.badge.plus")
            }
            .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
          } footer: {
            Text("确认购买后会新增购买记录，并将这条心愿标记为已入手。")
          }
        }

        if item != nil {
          Section {
            Button(role: .destructive) {
              confirmingDelete = true
            } label: {
              Text("删除心愿")
            }
          }
        }
      }
      .scrollDismissesKeyboard(.interactively)
      .navigationTitle(item == nil ? "新增心愿" : "编辑心愿")
      .navigationBarTitleDisplayMode(.inline)
      .disabled(isPerformingAction)
      .operationFailure($actionError)
      .confirmationDialog("删除这条心愿？", isPresented: $confirmingDelete, titleVisibility: .visible) {
        Button("删除心愿", role: .destructive) {
          guard let item else { return }
          isPerformingAction = true
          Task { @MainActor in
            defer { isPerformingAction = false }
            if await session.deleteWishlistItem(id: item.id) { dismiss() }
            else { actionError = session.errorMessage }
          }
        }
      }
      .editorActions(isValid: !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && NumericInput.validOptional(targetPrice) && NumericInput.validOptional(currentPrice),
        isBusy: isPerformingAction,
        draft: [name, brandName, categoryName, targetPrice, currentPrice, String(priority), status.rawValue, sourceUrl, imageUrl, notes],
        save: save)
      .sheet(item: $purchasingItem, onDismiss: syncStatusFromSession) { item in
        AddPurchaseView(initialWishlistItem: item)
      }
    }
  }

  private func save() async -> Bool {
    let input = WishlistEditInput(
      name: name,
      targetPriceCny: Double(targetPrice),
      currentSeenPriceCny: Double(currentPrice),
      priority: priority,
      status: status,
      sourceUrl: sourceUrl.nilIfEmpty,
      imageUrl: imageUrl.nilIfEmpty,
      notes: notes.nilIfEmpty,
      brandName: brandName.nilIfEmpty,
      categoryName: categoryName.nilIfEmpty
    )

    if let item {
      return await session.updateWishlistItem(id: item.id, input: input)
    } else {
      return await session.createWishlistItem(input)
    }
  }

  private func syncStatusFromSession() {
    guard let item,
          let latest = session.wishlistItems.first(where: { $0.id == item.id }) else {
      return
    }
    status = latest.status
  }

  private func webURL(from rawValue: String) -> URL? {
    guard let value = rawValue.nilIfEmpty,
          let url = URL(string: value),
          let scheme = url.scheme?.lowercased(),
          scheme == "http" || scheme == "https" else {
      return nil
    }
    return url
  }

  private static func formatPrice(_ value: Double) -> String {
    value.formatted(.number.grouping(.never).precision(.fractionLength(0...2)).locale(Locale(identifier: "en_US_POSIX")))
  }
}

private enum WishlistSheet: Identifiable {
  case newItem
  case edit(WishlistItem)
  case purchase(WishlistItem)

  var id: String {
    switch self {
    case .newItem:
      "new"
    case .edit(let item):
      "edit-\(item.id)"
    case .purchase(let item):
      "purchase-\(item.id)"
    }
  }
}

private enum WishlistFilter: String, CaseIterable, Identifiable {
  case all
  case active
  case purchased
  case dropped

  var id: String { rawValue }

  var label: String {
    switch self {
    case .all: "全部"
    case .active: "进行中"
    case .purchased: "已入手"
    case .dropped: "已放弃"
    }
  }

  func matches(_ item: WishlistItem) -> Bool {
    switch self {
    case .all: true
    case .active: item.status.isActive
    case .purchased: item.status == .purchased
    case .dropped: item.status == .dropped
    }
  }
}

private enum WishlistSort: String, CaseIterable, Identifiable {
  case priority
  case targetPrice
  case currentPrice

  var id: String { rawValue }

  var label: String {
    switch self {
    case .priority: "优先级"
    case .targetPrice: "目标价"
    case .currentPrice: "当前价"
    }
  }

  var systemImage: String {
    switch self {
    case .priority: "flag"
    case .targetPrice: "target"
    case .currentPrice: "yensign"
    }
  }

  func areInIncreasingOrder(_ left: WishlistItem, _ right: WishlistItem) -> Bool {
    let leftStatusRank = Self.statusRank(left.status)
    let rightStatusRank = Self.statusRank(right.status)
    if leftStatusRank != rightStatusRank {
      return leftStatusRank < rightStatusRank
    }

    switch self {
    case .priority:
      if left.priority != right.priority {
        return left.priority > right.priority
      }
    case .targetPrice:
      let leftPrice = left.targetPriceCny ?? -.infinity
      let rightPrice = right.targetPriceCny ?? -.infinity
      if leftPrice != rightPrice {
        return leftPrice > rightPrice
      }
    case .currentPrice:
      let leftPrice = left.currentSeenPriceCny ?? -.infinity
      let rightPrice = right.currentSeenPriceCny ?? -.infinity
      if leftPrice != rightPrice {
        return leftPrice > rightPrice
      }
    }

    return left.name.localizedCompare(right.name) == .orderedAscending
  }

  private static func statusRank(_ status: WishlistStatus) -> Int {
    switch status {
    case .want: 0
    case .watching: 1
    case .purchased: 2
    case .dropped: 3
    }
  }
}

private enum WishlistPriority {
  static func label(for value: Int) -> String {
    switch value {
    case 5: "最高优先"
    case 4: "高优先"
    case 3: "中优先"
    case 2: "低优先"
    default: "最低优先"
    }
  }
}

private extension String {
  var nilIfEmpty: String? {
    let value = trimmingCharacters(in: .whitespacesAndNewlines)
    return value.isEmpty ? nil : value
  }
}
