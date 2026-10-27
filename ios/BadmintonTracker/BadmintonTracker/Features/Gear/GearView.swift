import PhotosUI
import Observation
import Charts
import SwiftUI
import UIKit

struct GearView: View {
  @Namespace private var equipmentTransition
  @Environment(AppSession.self) private var session
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.appNavigation) private var navigation
  @Environment(\.appAccentColor) private var accent
  @Environment(\.appReduceMotion) private var reduceMotion
  @State private var highlightedGearID: String?
  @State private var repeatPurchase: PurchaseRecord?
  @State private var query = ""
  @State private var selectedArchiveView: GearArchiveView = .wall
  @State private var pegboardMode: PegboardLayoutMode = .active
  @State private var pegboardRendering = PegboardRenderModel()
  @State private var selectedCategory: GearWallCategory = .all
  @AppStorage("gear.pegboard.sortOrder") private var pegboardSortOrder: PegboardSortOrder = .automatic
  @State private var selectedSort: GearWallSort = .recentPurchase
  @State private var selectedGearItem: GearWallItem?
  @State private var showingPurchase = false

  private var cardColumns: [GridItem] {
    dynamicTypeSize >= .xxxLarge
      ? [GridItem(.flexible(), spacing: 14)]
      : [GridItem(.adaptive(minimum: 164), spacing: 14)]
  }

  private var filteredItems: [GearWallItem] {
    session.gearWallItems
      .filter { item in
        selectedCategory.matches(item)
      }
      .filter { item in
        guard !query.isEmpty else { return true }
        return item.searchText.localizedCaseInsensitiveContains(query)
      }
      .sorted { selectedSort($0, $1) }
  }

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        VStack(alignment: .leading, spacing: 14) {
          viewPicker

          if !session.gearWallItems.isEmpty { controls }

          if let errorMessage = session.errorMessage {
            ErrorBanner(message: errorMessage)
          }

          if session.isLoading && !session.hasLoadedInitialData {
            LoadingStateView(title: "正在整理装备墙", message: "会根据本地购买记录生成装备档案。")
              .padding(.horizontal)
          } else if selectedArchiveView == .wall && filteredItems.isEmpty {
            EmptyStateView(title: session.gearWallItems.isEmpty ? "还没有装备" : "没有匹配的装备",
              message: session.gearWallItems.isEmpty ? "记录一次购买，建立你的装备清单。" : "试试其他关键词，或清除分类筛选。",
              systemImage: selectedArchiveView.systemImage,
              actionTitle: session.gearWallItems.isEmpty ? "记录购买" : "清除搜索与筛选",
              action: {
                if session.gearWallItems.isEmpty { showingPurchase = true }
                else { query = ""; selectedCategory = .all }
              })
              .padding(.horizontal)
          } else if selectedArchiveView == .pegboard && pegboardItems.isEmpty {
            EmptyStateView(title: "没有可展示的装备", message: "洞洞板展示球筒、球拍和球鞋。试试其他筛选条件。", systemImage: selectedArchiveView.systemImage, actionTitle: "查看全部装备", action: { query = ""; selectedCategory = .all; selectedArchiveView = .wall })
              .padding(.horizontal)
          } else if selectedArchiveView == .wall {
            LazyVGrid(columns: cardColumns, spacing: 14) {
              ForEach(filteredItems) { item in
                Button {
                  selectedGearItem = item
                } label: {
                  GearWallCard(item: item)
                    .equipmentZoomSource(id: item.id, namespace: equipmentTransition)
                }
                .buttonStyle(.plain)
                .contextMenu {
                  if let purchase = latestPurchase(for: item) {
                    Button { repeatPurchase = purchase } label: {
                      Label("再买一次", systemImage: "arrow.clockwise")
                    }
                  }
                }
                .overlay(AppSurfaceStyle.card.shape
                  .strokeBorder(accent.opacity(highlightedGearID == item.id ? 1 : 0), lineWidth: 2)
                  .allowsHitTesting(false))
                .id(item.id)
              }
            }
            .padding(.horizontal)
            .padding(.bottom, 28)
          } else {
            GearPegboardView(items: pegboardItems, sortOrder: $pegboardSortOrder, mode: $pegboardMode, rendering: pegboardRendering, onSelect: { selectedGearItem = $0 })
              .padding(.horizontal)
              .padding(.bottom, 28)
          }
        }
      }
      .background(Color(.systemGroupedBackground))
      .searchable(text: $query, prompt: "搜索我的装备")
      .navigationTitle("我的装备")
      .navigationBarTitleDisplayMode(.inline)
      .navigationDestination(item: $selectedGearItem) { item in
        GearDetailView(item: item)
          .equipmentZoomDestination(id: item.id, namespace: equipmentTransition, enabled: selectedArchiveView == .wall)
      }
      .sheet(isPresented: $showingPurchase) { AddPurchaseView() }
      .sheet(item: $repeatPurchase) { AddPurchaseView(initialPurchase: $0) }
      .task(id: navigation?.gearReveal?.id) {
        guard let request = navigation?.gearReveal else { return }
        selectedGearItem = nil
        query = ""
        selectedCategory = .all
        selectedArchiveView = .wall
        do {
          // Let the success sheet dismiss and the unfiltered grid lay out first.
          try await Task.sleep(for: .milliseconds(350))
          withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.25)) {
            proxy.scrollTo(request.gearID, anchor: .center)
            highlightedGearID = request.gearID
          }
          try await Task.sleep(for: .seconds(2))
          withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) { highlightedGearID = nil }
          if navigation?.gearReveal?.id == request.id { navigation?.gearReveal = nil }
        } catch { highlightedGearID = nil }
      }
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button { showingPurchase = true } label: { Image(systemName: "plus") }
            .accessibilityLabel("记录购买")
        }
      }
    }
  }

  private func latestPurchase(for item: GearWallItem) -> PurchaseRecord? {
    session.purchases.filter { $0.matchesGearItem(item) }.max { $0.purchaseSortDate < $1.purchaseSortDate }
  }

  private var pegboardItems: [GearWallItem] {
    filteredItems
      .filter(\.isPegboardDisplayable)
  }

  private var viewPicker: some View {
    Picker("视图", selection: $selectedArchiveView) {
      ForEach(GearArchiveView.allCases) { view in
        Text(LocalizedStringKey(view.label)).tag(view)
      }
    }
    .adaptivePickerStyle()
    .padding(.horizontal)
    .padding(.top, 4)
  }

  private var controls: some View {
    HStack(spacing: 12) {
      Menu {
        Picker("分类", selection: $selectedCategory) {
          ForEach(GearWallCategory.allCases) { category in
            Text(LocalizedStringKey(category.label)).tag(category)
          }
        }
      } label: {
        Label(LocalizedStringKey(selectedCategory.label), systemImage: "line.3.horizontal.decrease")
      }
      Spacer(minLength: 0)
      if selectedArchiveView == .wall {
        Menu {
          Picker("排序方式", selection: $selectedSort) {
            ForEach(GearWallSort.allCases) { sort in
              Text(LocalizedStringKey(sort.label)).tag(sort)
            }
          }
        } label: {
          Label(LocalizedStringKey(selectedSort.label), systemImage: "arrow.up.arrow.down")
        }
      } else {
        Menu {
          Picker("排序方式", selection: $pegboardSortOrder) {
            ForEach(PegboardSortOrder.allCases) { order in
              Text(LocalizedStringKey(order.label)).tag(order)
            }
          }
        } label: {
          Label(LocalizedStringKey(pegboardSortOrder.label), systemImage: "arrow.up.arrow.down")
        }
      }
    }
    .font(.subheadline)
    .frame(minHeight: 44)
    .padding(.horizontal)
  }

}

private struct GearSearchModifier: ViewModifier {
  @Binding var query: String
  let isEnabled: Bool

  @ViewBuilder
  func body(content: Content) -> some View {
    if isEnabled {
      content.searchable(text: $query, prompt: "搜索装备、品牌或型号")
    } else {
      content
    }
  }
}

struct PegboardRenderInput: Hashable {
  let items: [GearWallItem]
  let purchases: [PurchaseRecord]
  let sortOrder: PegboardSortOrder
  let mode: PegboardLayoutMode
  let savedSnapshot: PegboardLayoutSnapshot?
  let width: CGFloat

  var instanceCount: Int {
    items.reduce(0) { $0 + max(0, $1.activeQuantity) + (mode == .history ? $1.historicalQuantity : 0) }
  }
}

@MainActor @Observable
final class PegboardRenderModel {
  fileprivate private(set) var layout: PegboardNativeLayout?
  private(set) var renderCount = 0
  private(set) var isRendering = false
  @ObservationIgnored private var cachedLayouts: [PegboardRenderInput: PegboardNativeLayout] = [:]

  func render(_ input: PegboardRenderInput) async {
    guard input.width > 0 else { return }
    if let cached = cachedLayouts[input] {
      layout = cached
      isRendering = false
      return
    }
    isRendering = true
    var instances: [PegboardInstance] = []
    for item in input.sortOrder.sorted(input.items, purchases: input.purchases) {
      guard !Task.isCancelled else { return }
      let category = item.resolvedCategoryName
      let asset = await GearImageLoader.asset(for: GearImageRequest(imageKey: item.imageKey,
        coverImageUrl: item.coverImageUrl, categoryName: category, maxPixelSize: 1024, normalizeForPegboard: true))
      guard !Task.isCancelled else { return }
      let active = max(0, item.activeQuantity)
      for index in 0..<active {
        instances.append(PegboardInstance(item: item, categoryName: category, mode: .active,
          index: index, indexInGroup: index + 1, image: asset.image, shuttleGeometry: asset.shuttleGeometry))
      }
      if input.mode == .history {
        for index in 0..<item.historicalQuantity {
          instances.append(PegboardInstance(item: item, categoryName: category, mode: .history,
            index: index, indexInGroup: active + index + 1, image: asset.image, shuttleGeometry: asset.shuttleGeometry))
        }
      }
    }
    // Image work is complete. Layout now uses only values and prepared assets.
    let rendered = PegboardNativeLayout(instances: instances, savedSnapshot: input.savedSnapshot,
      boardWidth: input.width, preserveOrder: input.sortOrder != .automatic)
    if cachedLayouts.count >= 4 { cachedLayouts.removeAll(keepingCapacity: true) }
    cachedLayouts[input] = rendered
    layout = rendered
    renderCount += 1
    isRendering = false
  }
}

private struct GearPegboardView: View {
  @Environment(AppSession.self) private var session
  let items: [GearWallItem]
  @Binding var sortOrder: PegboardSortOrder
  @Binding var mode: PegboardLayoutMode
  let rendering: PegboardRenderModel
  let onSelect: (GearWallItem) -> Void
  @State private var boardWidth: CGFloat = 0

  private var input: PegboardRenderInput {
    PegboardRenderInput(items: items, purchases: sortOrder == .firstPurchase ? session.purchases : [],
      sortOrder: sortOrder, mode: mode,
      savedSnapshot: sortOrder == .automatic ? session.pegboardLayouts[mode] : nil, width: boardWidth)
  }

  var body: some View {
    let request = input
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 12) {
        Picker("模式", selection: $mode) {
          ForEach(PegboardLayoutMode.allCases) { mode in
            Text(LocalizedStringKey(mode.label)).tag(mode)
          }
        }
        .adaptivePickerStyle()
        Text("\(request.instanceCount) 件")
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(.secondary)
          .frame(minWidth: 44, alignment: .trailing)
      }

      if request.instanceCount == 0 {
        EmptyStateView(title: mode == .active ? "暂无在用装备" : "暂无历史装备",
          message: mode == .active ? "在购买记录里把装备状态设为在用后，会出现在这里。" : "历史模式会一起展示在用装备和已用完、退役装备。",
          systemImage: "circle.grid.cross")
      } else {
        ZStack(alignment: .topLeading) {
          PegboardBackground().appSurface(.media)
          if let layout = rendering.layout, !rendering.isRendering {
            ForEach(layout.placedInstances) { placed in
              PegboardItemView(placed: placed) {
                if let item = items.first(where: { $0.id == placed.gearID }) { onSelect(item) }
              }
            }
          } else {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
              .accessibilityLabel("正在整理洞洞板")
          }
        }
        .frame(height: rendering.layout?.boardHeight ?? 700)
      }
    }
    .background(GeometryReader { proxy in
      Color.clear.onChange(of: proxy.size.width, initial: true) { _, width in
        boardWidth = width.rounded()
      }
    })
    .task(id: request) { await rendering.render(request) }
  }
}

private struct PegboardBackground: View {
  var body: some View {
    Canvas { context, size in
      context.fill(
        Path(CGRect(origin: .zero, size: size)),
        with: .linearGradient(
          Gradient(colors: [Color(.secondarySystemGroupedBackground), Color(.systemBackground)]),
          startPoint: .zero,
          endPoint: CGPoint(x: 0, y: size.height)
        )
      )

      let spacing: CGFloat = 22
      let radius: CGFloat = 1.6
      var y: CGFloat = 16
      while y < size.height {
        var x: CGFloat = 16
        while x < size.width {
          let rect = CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)
          context.fill(Path(ellipseIn: rect), with: .color(Color(.tertiaryLabel).opacity(0.26)))
          x += spacing
        }
        y += spacing
      }
    }
  }
}

private struct PegboardItemView: View {
  @Environment(\.appReduceMotion) private var reduceMotion
  let placed: PlacedPegboardInstance
  let onSelect: () -> Void

  var body: some View {
    Button(action: onSelect) {
    Group {
      if let pegboardImage = placed.pegboardImage {
        Image(uiImage: pegboardImage)
          .resizable()
          .scaledToFit()
          .opacity(placed.isActive ? 1 : 0.45)
          .grayscale(placed.isActive ? 0 : 0.6)
      } else if let url = placed.imageURL {
        AsyncImage(url: url, transaction: Transaction(animation: reduceMotion ? nil : .easeInOut)) { phase in
          switch phase {
          case .empty:
            ProgressView()
              .scaleEffect(0.75)
          case .success(let image):
            image
              .resizable()
              .scaledToFit()
              .opacity(placed.isActive ? 1 : 0.45)
              .grayscale(placed.isActive ? 0 : 0.6)
          case .failure:
            PegboardFallbackLabel(name: placed.name, isActive: placed.isActive)
          @unknown default:
            PegboardFallbackLabel(name: placed.name, isActive: placed.isActive)
          }
        }
      } else {
        PegboardFallbackLabel(name: placed.name, isActive: placed.isActive)
      }
    }
    .frame(width: placed.width, height: placed.height)
    .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .rotationEffect(.degrees(placed.rotate))
    .position(x: placed.x + placed.width / 2, y: placed.y + placed.height / 2)
    .zIndex(Double(placed.z))
    .accessibilityLabel(placed.name)
  }
}

private struct PegboardFallbackLabel: View {
  let name: String
  let isActive: Bool

  var body: some View {
    Text(name)
      .font(.caption2.weight(.semibold))
      .foregroundStyle(.secondary)
      .multilineTextAlignment(.center)
      .lineLimit(3)
      .padding(8)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color(.systemBackground).opacity(isActive ? 0.86 : 0.45), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .stroke(.quaternary, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
      )
  }
}

private struct PegboardNativeLayout {
  let placedInstances: [PlacedPegboardInstance]
  let boardHeight: CGFloat

  init(instances: [PegboardInstance], savedSnapshot: PegboardLayoutSnapshot?, boardWidth: CGFloat, preserveOrder: Bool = false) {
    if let savedSnapshot, !savedSnapshot.slots.isEmpty {
      let saved = Self.savedLayout(instances: instances, snapshot: savedSnapshot, boardWidth: boardWidth)
      if !saved.placedInstances.isEmpty {
        placedInstances = saved.placedInstances
        boardHeight = saved.boardHeight
        return
      }
    }

    let recommended = Self.recommendedLayout(instances: instances, boardWidth: boardWidth, preserveOrder: preserveOrder)
    placedInstances = recommended.placedInstances
    boardHeight = recommended.boardHeight
  }

  static func preferredHeight(instances: [PegboardInstance], savedSnapshot: PegboardLayoutSnapshot?, boardWidth: CGFloat, preserveOrder: Bool = false) -> CGFloat {
    if let savedSnapshot, !savedSnapshot.slots.isEmpty {
      let sourceWidth = max(360, savedSnapshot.slots.values.map { CGFloat($0.x) }.max() ?? 360)
      let scale = boardWidth / max(1, sourceWidth + 120)
      return max(boardMinHeight(boardWidth), CGFloat(savedSnapshot.height) * scale)
    }

    return recommendedLayout(instances: instances, boardWidth: boardWidth, resolveImages: false, preserveOrder: preserveOrder).boardHeight
  }

  private static func savedLayout(
    instances: [PegboardInstance],
    snapshot: PegboardLayoutSnapshot,
    boardWidth: CGFloat
  ) -> PegboardNativeLayout {
    let sizes = Dictionary(uniqueKeysWithValues: instances.map { ($0.id, $0.baseSize(boardWidth: boardWidth)) })
    let sourceRight = snapshot.slots.reduce(CGFloat(360)) { current, entry in
      let size = sizes[entry.key] ?? CGSize(width: 72, height: 72)
      let slot = entry.value
      return max(current, CGFloat(slot.x) + size.width * CGFloat(slot.scale) + 32)
    }
    let scale = boardWidth / max(1, sourceRight)
    let placed = instances.compactMap { instance -> PlacedPegboardInstance? in
      guard let slot = snapshot.slots[instance.id] else { return nil }
      let baseSize = instance.baseSize(boardWidth: boardWidth)
      let itemScale = max(0.45, CGFloat(slot.scale)) * min(1, scale * 1.3)
      let width = baseSize.width * itemScale
      let height = baseSize.height * itemScale
      return PlacedPegboardInstance(
        id: instance.id,
        gearID: instance.item.id,
        name: instance.item.displayName,
        pegboardImage: instance.image,
        imageURL: GearImageResolver.preferredImageURL(
          imageKey: instance.item.imageKey,
          coverImageUrl: instance.item.coverImageUrl
        ),
        isActive: instance.mode == .active,
        x: CGFloat(slot.x) * scale,
        y: CGFloat(slot.y) * scale,
        width: width,
        height: height,
        rotate: slot.rotate,
        z: slot.z
      )
    }

    let bottom = placed.map { $0.y + $0.height + 32 }.max() ?? 520
    let height = max(520, min(max(bottom, CGFloat(snapshot.height) * scale), 1_800))
    return PegboardNativeLayout(placedInstances: placed, boardHeight: height)
  }

  private static func recommendedLayout(
    instances: [PegboardInstance],
    boardWidth: CGFloat,
    resolveImages: Bool = true,
    preserveOrder: Bool = false
  ) -> PegboardNativeLayout {
    let padding = boardPadding(boardWidth)
    let gap = boardGap(boardWidth)
    let shuttleXGap = shuttleGapX(boardWidth)
    let shuttleYGap = shuttleGapY(boardWidth)
    let zoneGap = sectionGap(boardWidth)
    let baseBoardHeight = boardMinHeight(boardWidth)
    var z = 2
    var placed: [PlacedPegboardInstance] = []

    let sorted = preserveOrder ? instances : instances.sorted { left, right in
      let priority = left.categoryPriority - right.categoryPriority
      if priority != 0 { return priority < 0 }
      let leftSize = left.baseSize(boardWidth: boardWidth)
      let rightSize = right.baseSize(boardWidth: boardWidth)
      let leftArea = leftSize.width * leftSize.height
      let rightArea = rightSize.width * rightSize.height
      if leftArea != rightArea { return leftArea > rightArea }
      return left.indexInGroup < right.indexInGroup
    }

    let shuttles = sorted.filter { $0.isShuttle }
    let shuttleInstances = preserveOrder ? shuttles : shuttles.sorted(by: compareShuttleInstances)
    let racketInstances = sorted.filter { $0.isRacket }
    let shoesInstances = sorted.filter { $0.isShoes }
    let otherInstances = sorted.filter { !$0.isShuttle && !$0.isRacket && !$0.isShoes }

    func makePlaced(
      _ instance: PegboardInstance,
      x: CGFloat,
      y: CGFloat,
      size: CGSize,
      rotate: Double
    ) -> PlacedPegboardInstance {
      PlacedPegboardInstance(
        id: instance.id,
        gearID: instance.item.id,
        name: instance.item.displayName,
        pegboardImage: resolveImages ? instance.image : nil,
        imageURL: resolveImages
          ? GearImageResolver.preferredImageURL(
            imageKey: instance.item.imageKey,
            coverImageUrl: instance.item.coverImageUrl
          )
          : nil,
        isActive: instance.mode == .active,
        x: x,
        y: y,
        width: size.width,
        height: size.height,
        rotate: rotate,
        z: z
      )
    }

    func placeFlowSection(
      _ sectionInstances: [PegboardInstance],
      startY: CGFloat,
      itemGap: CGFloat,
      rowGap: CGFloat,
      shouldWrapFirstItem: Bool = false
    ) -> CGFloat {
      guard !sectionInstances.isEmpty else { return startY }
      var x = padding
      var y = startY
      var rowHeight: CGFloat = 0

      for instance in sectionInstances {
        let baseSize = instance.baseSize(boardWidth: boardWidth)
        let rotate = instance.defaultRotate
        let scale = recommendedLayoutScale(
          width: baseSize.width,
          height: baseSize.height,
          rotate: rotate,
          boardWidth: boardWidth,
          boardHeight: baseBoardHeight
        )
        let size = CGSize(width: baseSize.width * scale, height: baseSize.height * scale)
        let footprint = footprintSize(width: size.width, height: size.height, rotate: rotate)
        let protrudeX = max(0, (footprint.width - size.width) / 2)
        let protrudeY = max(0, (footprint.height - size.height) / 2)

        if x + footprint.width > boardWidth - padding, shouldWrapFirstItem || x > padding {
          x = padding
          y += rowHeight + rowGap
          rowHeight = 0
        }

        placed.append(makePlaced(instance, x: x + protrudeX, y: y + protrudeY, size: size, rotate: rotate))
        x += footprint.width + itemGap
        rowHeight = max(rowHeight, footprint.height)
        z += 1
      }

      return y + rowHeight
    }

    func placeBottomAlignedSection(_ sectionInstances: [PegboardInstance], startY: CGFloat) -> CGFloat {
      guard !sectionInstances.isEmpty else { return startY }
      var rowItems: [(instance: PegboardInstance, size: CGSize, footprint: CGSize, protrudeX: CGFloat, protrudeY: CGFloat)] = []
      var rowWidth: CGFloat = 0
      var rowTop = startY
      var bottom = startY

      func flushRow() {
        guard !rowItems.isEmpty else { return }
        let rowHeight = rowItems.map { $0.footprint.height }.max() ?? 0
        var rowX = padding

        for item in rowItems {
          let yOffset = rowHeight - item.footprint.height
          placed.append(makePlaced(
            item.instance,
            x: rowX + item.protrudeX,
            y: rowTop + yOffset + item.protrudeY,
            size: item.size,
            rotate: item.instance.defaultRotate
          ))
          rowX += item.footprint.width + gap
          z += 1
        }

        bottom = max(bottom, rowTop + rowHeight)
        rowTop += rowHeight + gap
        rowItems = []
        rowWidth = 0
      }

      for instance in sectionInstances {
        let baseSize = instance.baseSize(boardWidth: boardWidth)
        let scale = recommendedLayoutScale(
          width: baseSize.width,
          height: baseSize.height,
          rotate: instance.defaultRotate,
          boardWidth: boardWidth,
          boardHeight: baseBoardHeight
        )
        let size = CGSize(width: baseSize.width * scale, height: baseSize.height * scale)
        let footprint = footprintSize(width: size.width, height: size.height, rotate: instance.defaultRotate)
        let item = (
          instance,
          size,
          footprint,
          max(0, (footprint.width - size.width) / 2),
          max(0, (footprint.height - size.height) / 2)
        )
        let nextWidth = rowItems.isEmpty ? footprint.width : rowWidth + gap + footprint.width

        if nextWidth > boardWidth - padding * 2, !rowItems.isEmpty {
          flushRow()
        }

        rowItems.append(item)
        rowWidth = rowItems.count == 1 ? footprint.width : rowWidth + gap + footprint.width
      }
      flushRow()
      return bottom
    }

    // Align straight-side bottoms, while reserving full cap extents for row spacing.
    func placeShuttles() -> CGFloat {
      var row: [(instance: PegboardInstance, size: CGSize, baseline: CGFloat)] = []
      var rowWidth: CGFloat = 0
      var rowTop = padding
      var bottom = padding
      func flushRow() {
        guard !row.isEmpty else { return }
        let ascent = row.map { $0.baseline }.max() ?? 0
        let descent = row.map { $0.size.height - $0.baseline }.max() ?? 0
        var x = padding
        for entry in row {
          placed.append(makePlaced(entry.instance, x: x,
            y: rowTop + ascent - entry.baseline, size: entry.size, rotate: 0))
          x += entry.size.width + shuttleXGap
          z += 1
        }
        bottom = rowTop + ascent + descent
        rowTop = bottom + shuttleYGap
        row.removeAll(keepingCapacity: true)
        rowWidth = 0
      }
      for instance in shuttleInstances {
        let base = instance.baseSize(boardWidth: boardWidth)
        let scale = recommendedLayoutScale(width: base.width, height: base.height, rotate: 0,
          boardWidth: boardWidth, boardHeight: baseBoardHeight)
        let size = CGSize(width: base.width * scale, height: base.height * scale)
        let nextWidth = row.isEmpty ? size.width : rowWidth + shuttleXGap + size.width
        if nextWidth > boardWidth - padding * 2, !row.isEmpty { flushRow() }
        let baseline = size.height * (instance.shuttleGeometry?.baselineFraction ?? 1)
        rowWidth += (row.isEmpty ? 0 : shuttleXGap) + size.width
        row.append((instance, size, baseline))
      }
      flushRow()
      return bottom
    }

    let shuttleBottom = placeShuttles()
    let racketTop = shuttleInstances.isEmpty ? padding : shuttleBottom + zoneGap
    let racketBottom = placeFlowSection(racketInstances, startY: racketTop, itemGap: gap, rowGap: gap)
    let shoesTop = (shuttleInstances.isEmpty && racketInstances.isEmpty) ? padding : racketBottom + zoneGap
    let shoesBottom = placeBottomAlignedSection(shoesInstances, startY: shoesTop)
    let otherTop = shoesInstances.isEmpty ? shoesTop : shoesBottom + zoneGap
    let otherBottom = placeFlowSection(otherInstances, startY: otherTop, itemGap: gap, rowGap: gap)

    let contentBottom = [shuttleBottom, racketBottom, shoesBottom, otherBottom].max() ?? padding
    let height = max(boardMinHeight(boardWidth), ceil(contentBottom + padding + 44))
    return PegboardNativeLayout(placedInstances: placed, boardHeight: height)
  }

  private static func estimatedRecommendedHeight(instances: [PegboardInstance], boardWidth: CGFloat) -> CGFloat {
    recommendedLayout(instances: instances, boardWidth: boardWidth, resolveImages: false).boardHeight
  }

  private static func boardMinHeight(_ boardWidth: CGFloat) -> CGFloat {
    boardWidth < 640 ? 700 : 960
  }

  private static func boardPadding(_ boardWidth: CGFloat) -> CGFloat {
    boardWidth < 640 ? 16 : 28
  }

  private static func boardGap(_ boardWidth: CGFloat) -> CGFloat {
    boardWidth < 640 ? 14 : 24
  }

  private static func shuttleGapX(_ boardWidth: CGFloat) -> CGFloat {
    boardWidth < 640 ? 6 : 8
  }

  private static func shuttleGapY(_ boardWidth: CGFloat) -> CGFloat {
    boardWidth < 640 ? 8 : 12
  }

  private static func sectionGap(_ boardWidth: CGFloat) -> CGFloat {
    boardWidth < 640 ? 24 : 38
  }

  private static func recommendedLayoutScale(
    width: CGFloat,
    height: CGFloat,
    rotate: Double,
    boardWidth: CGFloat,
    boardHeight: CGFloat
  ) -> CGFloat {
    min(1, fitScaleToBoard(
      width: width,
      height: height,
      rotate: rotate,
      boardWidth: boardWidth,
      boardHeight: boardHeight
    ))
  }

  private static func fitScaleToBoard(
    width: CGFloat,
    height: CGFloat,
    rotate: Double,
    boardWidth: CGFloat,
    boardHeight: CGFloat
  ) -> CGFloat {
    let padding = boardPadding(boardWidth)
    let footprint = footprintSize(width: width, height: height, rotate: rotate)
    let availableWidth = max(120, boardWidth - padding * 2)
    let availableHeight = max(120, boardHeight - padding * 2)
    let mobileScaleCap: CGFloat = boardWidth < 640 ? 1.15 : 2.4

    return max(
      0.28,
      min(
        mobileScaleCap,
        availableWidth / max(1, footprint.width),
        availableHeight / max(1, footprint.height)
      )
    )
  }

  private static func footprintSize(width: CGFloat, height: CGFloat, rotate: Double) -> CGSize {
    let radians = CGFloat(rotate * .pi / 180)
    let cosValue = abs(cos(radians))
    let sinValue = abs(sin(radians))
    return CGSize(
      width: width * cosValue + height * sinValue,
      height: width * sinValue + height * cosValue
    )
  }

  private static func compareShuttleInstances(_ left: PegboardInstance, _ right: PegboardInstance) -> Bool {
    let leftBrand = left.item.brand?.name.normalizedPegboardSortKey ?? ""
    let rightBrand = right.item.brand?.name.normalizedPegboardSortKey ?? ""
    if leftBrand != rightBrand {
      return leftBrand.localizedCompare(rightBrand) == .orderedAscending
    }

    let leftModel = (left.item.modelCode ?? left.item.name).normalizedPegboardSortKey
    let rightModel = (right.item.modelCode ?? right.item.name).normalizedPegboardSortKey
    if leftModel != rightModel {
      return leftModel.localizedStandardCompare(rightModel) == .orderedAscending
    }

    return left.index < right.index
  }

  private init(placedInstances: [PlacedPegboardInstance], boardHeight: CGFloat) {
    self.placedInstances = placedInstances
    self.boardHeight = boardHeight
  }
}

private struct PegboardInstance: Identifiable {
  let item: GearWallItem
  let categoryName: String
  let mode: PegboardLayoutMode
  let index: Int
  let indexInGroup: Int
  let image: UIImage?
  let shuttleGeometry: ShuttleTubeGeometry?

  var id: String {
    "\(item.id)::\(mode.rawValue)::\(index)"
  }

  var defaultRotate: Double {
    0
  }

  var categoryPriority: Int {
    if categoryName.contains("羽毛球") { return 1 }
    if categoryName.contains("球鞋") { return 2 }
    if categoryName.contains("球拍") { return 3 }
    return 9
  }

  var isShuttle: Bool {
    categoryName.contains("羽毛球")
  }

  var isRacket: Bool {
    categoryName.contains("球拍")
  }

  var isShoes: Bool {
    categoryName.contains("球鞋")
  }

  func baseSize(boardWidth: CGFloat) -> CGSize {
    let longestPx = physicalLongestCm * pixelPerCm(boardWidth: boardWidth) * mobileBoardScale(boardWidth: boardWidth)
    if isShuttle, let image {
      if let geometry = shuttleGeometry {
        return geometry.displaySize(sideLength: longestPx)
      }
      let size = image.size
      let scale = longestPx / max(1, max(size.width, size.height))
      return CGSize(width: size.width * scale, height: size.height * scale)
    }
    let rawAspect = fallbackAspect

    if isRacket {
      let ratio = clamp(max(rawAspect, 1 / max(rawAspect, 0.001)), min: 2.4, max: 8.6)
      return CGSize(width: longestPx / ratio, height: longestPx)
    }

    let aspect: CGFloat
    if isShuttle {
      aspect = clamp(rawAspect, min: 0.17, max: 0.2)
    } else if isShoes {
      aspect = clamp(rawAspect, min: 1.5, max: 3.4)
    } else {
      aspect = clamp(rawAspect, min: 0.2, max: 4.2)
    }

    if aspect >= 1 {
      return CGSize(width: longestPx, height: longestPx / aspect)
    }
    return CGSize(width: longestPx * aspect, height: longestPx)
  }

  private var physicalLongestCm: CGFloat {
    if isRacket { return 66.5 }
    if isShoes { return 28 }
    if isShuttle { return 40 }
    return 32
  }

  private var fallbackAspect: CGFloat {
    if isRacket { return 0.24 }
    if isShoes { return 1.5 }
    if isShuttle { return 0.18 }
    return 1
  }

  private func pixelPerCm(boardWidth: CGFloat) -> CGFloat {
    guard boardWidth > 0 else { return 5.8 }
    if boardWidth < 640 {
      return clamp(boardWidth / 200, min: 3.8, max: 6.2)
    }
    return clamp(boardWidth / 200, min: 5.8, max: 9.4)
  }

  private func mobileBoardScale(boardWidth: CGFloat) -> CGFloat {
    boardWidth < 640 ? 0.8 : 1
  }

  private func clamp(_ value: CGFloat, min: CGFloat, max: CGFloat) -> CGFloat {
    Swift.min(max, Swift.max(min, value))
  }
}

private extension String {
  var normalizedPegboardSortKey: String {
    lowercased()
      .replacingOccurrences(of: "\\s+", with: "", options: .regularExpression)
      .replacingOccurrences(of: "亚狮龙", with: "rsl")
      .replacingOccurrences(of: "超牌", with: "chao")
  }

  var nilIfEmpty: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}

private struct PlacedPegboardInstance: Identifiable {
  let id: String
  let gearID: String
  let name: String
  let pegboardImage: UIImage?
  let imageURL: URL?
  let isActive: Bool
  let x: CGFloat
  let y: CGFloat
  let width: CGFloat
  let height: CGFloat
  let rotate: Double
  let z: Int
}

struct GearDetailView: View {
  @State private var actionError: String?
  @State private var isDeleting = false

  @State private var showingQuickConsumption = false
  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  let item: GearWallItem

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @State private var showingEdit = false
  @State private var showingDeleteConfirmation = false
  @State private var selectedPurchase: PurchaseRecord?
  @State private var repeatPurchase: PurchaseRecord?
  @State private var stringingTarget: GearWallItem?
  @State private var selectedStringingRecord: StringingRecord?

  private var displayedItem: GearWallItem {
    session.gearWallItems.first { $0.id == item.id } ?? item
  }

  private var purchaseRecords: [PurchaseRecord] {
    session.purchases
      .filter { $0.matchesGearItem(displayedItem) }
      .sorted { $0.purchaseSortDate > $1.purchaseSortDate }
  }

  private var metricItems: [GearDetailMetricItem] {
    switch displayedItem.categoryBucket {
    case .shuttle:
      return [
        GearDetailMetricItem(title: "库存", value: "\(purchaseRecords.filter { $0.itemStatus != .wornOut }.reduce(0) { $0 + $1.remainingQuantity })"),
        GearDetailMetricItem(title: "累计", value: "\(displayedItem.totalQuantity)"),
        GearDetailMetricItem(title: "用完", value: "\(displayedItem.usedUpQuantity)"),
        GearDetailMetricItem(title: "均价", value: money(averageUnitPrice))
      ]
    case .racket:
      return [
        GearDetailMetricItem(title: "状态", value: displayedItem.ownershipStatusText),
        GearDetailMetricItem(title: "球线", value: displayedItem.racketDetails?.currentString?.nilIfEmpty ?? "未记录"),
        GearDetailMetricItem(title: "磅数", value: tensionText(main: displayedItem.racketDetails?.mainTension, cross: displayedItem.racketDetails?.crossTension) ?? "未记录"),
        GearDetailMetricItem(title: "购买价", value: money(displayedItem.referenceUnitPriceCny))
      ]
    case .shoes:
      return [
        GearDetailMetricItem(title: "状态", value: displayedItem.ownershipStatusText),
        GearDetailMetricItem(title: "尺码", value: displayedItem.shoesSizeSummary ?? "未记录"),
        GearDetailMetricItem(title: "购买价", value: money(displayedItem.referenceUnitPriceCny)),
        GearDetailMetricItem(title: "最近购买", value: displayedItem.latestPurchaseDate.map(shortDate) ?? "未记录")
      ]
    case .all, .other:
      return [
        GearDetailMetricItem(title: "状态", value: displayedItem.ownershipStatusText),
        GearDetailMetricItem(title: "数量", value: "\(displayedItem.totalQuantity)"),
        GearDetailMetricItem(title: "购买价", value: money(displayedItem.referenceUnitPriceCny)),
        GearDetailMetricItem(title: "最近购买", value: displayedItem.latestPurchaseDate.map(shortDate) ?? "未记录")
      ]
    }
  }

  private var averageUnitPrice: Double? {
    guard !purchaseRecords.isEmpty else { return displayedItem.referenceUnitPriceCny }
    return purchaseRecords.reduce(0) { $0 + $1.unitPriceCny } / Double(purchaseRecords.count)
  }

  var body: some View {
    Group {
      ScrollView {
        VStack(alignment: .leading, spacing: 16) {
          RemoteImageView(
            url: GearImageResolver.preferredImageURL(imageKey: displayedItem.imageKey, coverImageUrl: displayedItem.coverImageUrl),
            systemImage: "photo",
            imageKey: displayedItem.imageKey,
            coverImageUrl: displayedItem.coverImageUrl,
            categoryName: displayedItem.resolvedCategoryName,
            surfaceStyle: .media
          )
          .aspectRatio(1, contentMode: .fit)
          .frame(maxWidth: 460)
          .frame(maxWidth: .infinity)

          VStack(alignment: .leading, spacing: 8) {
            Text(displayedItem.compactDisplayName)
              .font(.title2.weight(.bold))
            Text(displayedItem.metaText.isEmpty ? displayedItem.resolvedCategoryName : displayedItem.metaText)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }

          LazyVGrid(columns: dynamicTypeSize.isAccessibilitySize ? [GridItem(.flexible())] : [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            ForEach(metricItems) { metric in
              GearDetailMetric(title: metric.title, value: metric.value)
            }
          }

          GearProfileDetailSection(
            item: displayedItem,
            purchaseRecords: purchaseRecords,
            onAddStringingRecord: displayedItem.categoryBucket == .racket ? {
              stringingTarget = displayedItem
            } : nil,
            onEditStringingRecord: displayedItem.categoryBucket == .racket ? { record in
              selectedStringingRecord = record
            } : nil
          )

          VStack(spacing: 0) {
            GearDetailRow(title: "参考单价", value: money(displayedItem.referenceUnitPriceCny))
            if let latestPurchaseDate = displayedItem.latestPurchaseDate {
              Divider()
              GearDetailRow(title: "最近购买", value: shortDate(latestPurchaseDate))
            }
            if let createdAt = displayedItem.createdAt {
              Divider()
              GearDetailRow(title: "首次记录", value: shortDate(createdAt))
            }
          }
          .padding(.horizontal, 14)
          .appSurface()

          if purchaseRecords.contains(where: { $0.remainingQuantity > 0 }) {
            Button { showingQuickConsumption = true } label: {
              Label("记录消耗", systemImage: "minus.circle")
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(SemanticTint.consumption)
            .controlSize(.large)
          }

          ConsumptionHistoryCard(purchases: purchaseRecords)

          VStack(alignment: .leading, spacing: 10) {
            Text("购买记录")
              .font(.headline)

            if purchaseRecords.isEmpty {
              Text("暂无购买记录")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .appSurface()
            } else {
              VStack(spacing: 10) {
                ForEach(purchaseRecords) { purchase in
                  Button {
                    selectedPurchase = purchase
                  } label: {
                    PurchaseRecordCard(purchase: purchase)
                  }
                  .buttonStyle(.plain)
                }
              }
            }
          }

          Button(role: .destructive) {
            showingDeleteConfirmation = true
          } label: {
            Label("删除装备", systemImage: "trash")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .tint(SemanticTint.destructive)
          .controlSize(.large)
        }
        .padding()
      }
      .background(Color(.systemGroupedBackground))
      .disabled(isDeleting)
      .interactiveDismissDisabled(isDeleting)
      .operationFailure($actionError)
      .navigationTitle("装备详情")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Menu {
            Button { showingEdit = true } label: {
              Label("编辑", systemImage: "pencil")
            }
            if let latest = purchaseRecords.first {
              Button { repeatPurchase = latest } label: {
                Label("再买一次", systemImage: "arrow.clockwise")
              }
            }
          } label: {
            Image(systemName: "ellipsis")
          }
          .accessibilityLabel("更多操作")
        }
      }
      .sheet(isPresented: $showingQuickConsumption) {
        QuickConsumptionView(purchases: purchaseRecords.filter { $0.remainingQuantity > 0 })
      }
      .sheet(isPresented: $showingEdit) {
        GearEditView(item: displayedItem)
      }
      .sheet(item: $repeatPurchase) { AddPurchaseView(initialPurchase: $0) }
      .sheet(item: $selectedPurchase, onDismiss: {
        if !session.gearWallItems.contains(where: { $0.id == item.id }) { dismiss() }
      }) { purchase in
        PurchaseRecordEditView(purchase: purchase)
      }
      .sheet(item: $stringingTarget) { item in
        AddStringingRecordView(item: item)
      }
      .sheet(item: $selectedStringingRecord) { record in
        EditStringingRecordView(item: displayedItem, record: record)
      }
      .confirmationDialog("删除这件装备？", isPresented: $showingDeleteConfirmation, titleVisibility: .visible) {
        Button("删除", role: .destructive) {
          isDeleting = true
          Task {
            defer { isDeleting = false }
            if await session.deleteGearItem(id: displayedItem.id) { dismiss() }
            else { actionError = session.errorMessage }
          }
        }
      } message: {
        Text("相关购买记录会一起删除。")
      }
    }
  }
}

private struct GearEditView: View {
  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  let item: GearWallItem

  @State private var name: String
  @State private var brandName: String
  @State private var modelCode: String
  @State private var categoryName: String
  @State private var selectedPhoto: PhotosPickerItem?
  @State private var selectedPhotoImage: UIImage?
  @State private var selectedPhotoURLString: String?
  @State private var isProcessingPhoto = false
  @State private var photoRequestID: UUID?
  @State private var photoMessage: String?
  @State private var ballsPerTube: String
  @State private var shuttleSpeed: String
  @State private var racketWeightSpec: String
  @State private var racketGripSpec: String
  @State private var shoesSize: String
  @State private var shoesSizeSystem: String
  @State private var shoesColorway: String

  private let categoryOptions = ["羽毛球", "球鞋", "球拍", "其他"]

  init(item: GearWallItem) {
    self.item = item
    let shuttleDetails = item.shuttleDetails
    let racketDetails = item.racketDetails
    let shoesDetails = item.shoesDetails
    _selectedPhotoURLString = State(initialValue: GearPhotoProcessor.photoURL(for: item.coverImageUrl ?? "") != nil ? item.coverImageUrl : nil)
    _selectedPhotoImage = State(initialValue: GearImageResolver.localImage(imageKey: nil, coverImageUrl: item.coverImageUrl))
    _name = State(initialValue: item.name)
    _brandName = State(initialValue: item.brand?.name ?? "")
    _modelCode = State(initialValue: item.modelCode ?? "")
    _categoryName = State(initialValue: item.resolvedCategoryName)
    _ballsPerTube = State(initialValue: shuttleDetails?.ballsPerTube.map(String.init) ?? "12")
    _shuttleSpeed = State(initialValue: shuttleDetails?.speed ?? "")
    _racketWeightSpec = State(initialValue: RacketSpecOptions.normalizedWeightSpec(racketDetails?.weightSpec))
    _racketGripSpec = State(initialValue: RacketSpecOptions.normalizedGripSpec(racketDetails?.gripSpec))
    _shoesSize = State(initialValue: shoesDetails?.size ?? "")
    _shoesSizeSystem = State(initialValue: shoesDetails?.sizeSystem ?? "EU")
    _shoesColorway = State(initialValue: shoesDetails?.colorway ?? "")
  }

  var body: some View {
    NavigationStack {
      Form {
        Section("照片") {
          if let selectedPhotoImage {
            GearPhotoPreview(image: selectedPhotoImage, reference: selectedPhotoURLString, isProcessing: isProcessingPhoto)
          } else {
            RemoteImageView(
              url: GearImageResolver.preferredImageURL(imageKey: item.imageKey, coverImageUrl: item.coverImageUrl),
              systemImage: "photo",
              imageKey: item.imageKey,
              coverImageUrl: item.coverImageUrl,
              categoryName: item.resolvedCategoryName
            )
            .aspectRatio(1, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
          }

          PhotosPicker(selection: $selectedPhoto, matching: .images) {
            Label("更换装备照片", systemImage: "photo")
          }
          .disabled(isProcessingPhoto)

          if !isProcessingPhoto, let photoMessage {
            Text(photoMessage)
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
        }

        Section("装备") {
          TextField("名称", text: $name)
          TextField("品牌", text: $brandName)
          TextField("型号", text: $modelCode)
          Picker("分类", selection: $categoryName) {
            ForEach(categoryOptions, id: \.self) { option in
              Text(option).tag(option)
            }
          }
        }

        profileSection
      }
      .navigationTitle("编辑装备")
      .navigationBarTitleDisplayMode(.inline)
      .task(id: selectedPhoto) { await handlePhotoSelection(selectedPhoto) }
      .editorActions(isValid: !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
        isBusy: isProcessingPhoto,
        draft: [name, brandName, modelCode, categoryName, ballsPerTube, shuttleSpeed,
                racketWeightSpec, racketGripSpec, shoesSize, shoesSizeSystem, shoesColorway,
                selectedPhotoURLString ?? ""]) {
        await session.updateGearItem(
                id: item.id,
                input: GearEditInput(
                  name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                  brandName: brandName.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                  modelCode: modelCode.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                  categoryName: categoryName,
                  gearCoverImageUrl: selectedPhotoURLString,
                  profileDetails: profileDetailsForCurrentCategory()
                )
              )
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
      let result = try await GearPhotoProcessor.processImportedImage(image, categoryName: categoryName)
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
  @ViewBuilder
  private var profileSection: some View {
    if categoryName == "羽毛球" {
      Section("羽毛球规格") {
        TextField("每筒数量", text: $ballsPerTube)
          .keyboardType(.numberPad)
        TextField("速度号", text: $shuttleSpeed)
      }
    } else if categoryName == "球拍" {
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
    } else if categoryName == "球鞋" {
      Section("球鞋规格") {
        TextField("尺码", text: $shoesSize)
        Picker("尺码体系", selection: $shoesSizeSystem) {
          ForEach(["EU", "JP", "CN", "US"], id: \.self) { option in
            Text(option).tag(option)
          }
        }
        TextField("配色", text: $shoesColorway)
      }
    }
  }

  private func profileDetailsForCurrentCategory() -> GearProfileDetails? {
    if categoryName == "羽毛球" {
      return .shuttle(ShuttleGearDetails(
        ballsPerTube: Int(ballsPerTube.trimmingCharacters(in: .whitespacesAndNewlines)),
        speed: shuttleSpeed.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
      ))
    }

    if categoryName == "球拍" {
      let existing = item.racketDetails ?? RacketGearDetails()

      return .racket(RacketGearDetails(
        weightSpec: RacketSpecOptions.normalizedWeightSpec(racketWeightSpec),
        gripSpec: RacketSpecOptions.normalizedGripSpec(racketGripSpec),
        currentString: existing.currentString,
        mainTension: existing.mainTension,
        crossTension: existing.crossTension,
        stringingDate: existing.stringingDate,
        stringHistory: existing.stringHistory
      ))
    }

    if categoryName == "球鞋" {
      return .shoes(ShoesGearDetails(
        size: shoesSize.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
        sizeSystem: shoesSizeSystem.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
        colorway: shoesColorway.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
      ))
    }

    return nil
  }
}

private struct PurchaseRecordEditView: View {
  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  let purchase: PurchaseRecord

  @State private var consumptionRecords: [ConsumptionRecord]
  @State private var consumptionEntry: ConsumptionEntryRequest?
  @State private var undoCandidate: ConsumptionRecord?
  @State private var showingUndoConfirmation = false
  @State private var isDeleting = false
  @State private var price: String
  @State private var quantity: Int
  @State private var purchaseDate: Date
  @State private var statusDate: Date
  @State private var status: ItemStatus
  @State private var channel: String
  @State private var notes: String

  init(purchase: PurchaseRecord) {
    self.purchase = purchase
    _price = State(initialValue: purchase.unitPriceCny.formatted(.number.grouping(.never).precision(.fractionLength(0...2)).locale(Locale(identifier: "en_US_POSIX"))))
    _quantity = State(initialValue: purchase.quantity)
    _purchaseDate = State(initialValue: parseISODate(purchase.purchaseDate) ?? Date())
    _statusDate = State(initialValue: parseISODate(purchase.statusDate) ?? Date())
    _consumptionRecords = State(initialValue: purchase.consumptionHistory)
    _status = State(initialValue: purchase.itemStatus == .usedUp ? .inUse : purchase.itemStatus)
    _channel = State(initialValue: purchase.channel ?? "")
    _notes = State(initialValue: purchase.notes ?? "")
  }

  var body: some View {
    NavigationStack {
      Form {
        Section("购买") {
          LabeledInput(title: "实付单价", text: $price, prompt: "0.00", keyboard: .decimalPad, unit: "元")
          Stepper("数量 \(quantity)", value: $quantity, in: max(1, consumptionRecords.reduce(0) { $0 + $1.quantity })...max(99, purchase.quantity))
          DatePicker("购买日期", selection: $purchaseDate, displayedComponents: .date)
          Picker(consumptionRecords.isEmpty ? "状态" : "剩余装备状态", selection: $status) {
            ForEach(ItemStatus.allCases.filter { $0 != .usedUp }) { item in
              Text(LocalizedStringKey(item.label)).tag(item)
            }
          }
          if status.needsStatusDate {
            DatePicker(status.statusDateLabel, selection: $statusDate, displayedComponents: .date)
          }
          PurchaseChannelSelectionField(channel: $channel)
        }

        ConsumptionSection(records: consumptionRecords, quantity: quantity) {
          consumptionEntry = ConsumptionEntryRequest(
            maximum: max(0, quantity - consumptionRecords.reduce(0) { $0 + $1.quantity }),
            purchaseDate: purchaseDate
          )
        } onUndo: { record in
          undoCandidate = record
          showingUndoConfirmation = true
        }

        Section("备注") {
          TextField("可选", text: $notes, axis: .vertical)
            .lineLimit(3...5)
        }
        Section {
          PurchaseDeleteButton(purchase: purchase, isDeleting: $isDeleting)
        }
      }
      .disabled(isDeleting)
      .navigationTitle("编辑购买记录")
      .navigationBarTitleDisplayMode(.inline)
      .editorActions(isValid: Double(price).map { $0.isFinite && $0 >= 0 } ?? false, isBusy: isDeleting,
        draft: [price, String(quantity), String(purchaseDate.timeIntervalSince1970),
                String(statusDate.timeIntervalSince1970), status.rawValue, channel, notes,
                (try? JSONEncoder().encode(consumptionRecords).base64EncodedString()) ?? ""]) {
              return await session.updatePurchaseRecord(
                id: purchase.id,
                input: PurchaseEditInput(
                  consumptionRecords: consumptionRecords,
                  unitPriceCny: Double(price) ?? purchase.unitPriceCny,
                  quantity: quantity,
                  purchaseDate: ISO8601DateFormatter().string(from: purchaseDate),
                  statusDate: status.needsStatusDate ? ISO8601DateFormatter().string(from: statusDate) : nil,
                  channel: PurchaseChannelOptions.normalizedChannel(channel),
                  itemStatus: status,
                  notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
                )
              )
      }
    }
    // Keep presenters outside Form/Section: inserting or removing rows must not
    // replace the presentation host while a nested sheet is being dismissed.
    .sheet(item: $consumptionEntry) { request in
      ConsumptionEntryView(maximum: request.maximum, purchaseDate: request.purchaseDate) { record in
        consumptionRecords.append(record)
      }
    }
    .confirmationDialog("撤销这次消耗记录？", isPresented: $showingUndoConfirmation,
      titleVisibility: .visible, presenting: undoCandidate
    ) { record in
      Button("撤销记录", role: .destructive) {
        consumptionRecords.removeAll { $0.id == record.id }
      }
      Button("取消", role: .cancel) { }
    } message: { _ in
      Text("对应数量将恢复为剩余库存，点击保存后生效。")
    }
  }
}

private struct AddStringingRecordView: View {
  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  let item: GearWallItem

  @State private var stringName: String
  @State private var mainTension: String
  @State private var crossTension: String
  @State private var stringingDate = Date()
  @State private var cost: String
  @State private var channel: String
  @State private var notes = ""

  init(item: GearWallItem) {
    self.item = item
    _stringName = State(initialValue: RacketStringOptions.normalizedStringName(item.racketDetails?.currentString) ?? "")
    _mainTension = State(initialValue: item.racketDetails?.mainTension?.formatted(.number.precision(.fractionLength(0...1))) ?? "")
    _crossTension = State(initialValue: item.racketDetails?.crossTension?.formatted(.number.precision(.fractionLength(0...1))) ?? "")
    _stringingDate = State(initialValue: Date())
    _cost = State(initialValue: "")
    _channel = State(initialValue: "")
  }

  var body: some View {
    NavigationStack {
      Form {
        Section("穿线记录") {
          RacketStringSelectionField(stringName: $stringName)
          LabeledInput(title: "主线磅数", text: $mainTension, keyboard: .decimalPad, unit: "lb")
          LabeledInput(title: "横线磅数", text: $crossTension, keyboard: .decimalPad, unit: "lb")
          DatePicker("穿线日期", selection: $stringingDate, displayedComponents: .date)
          LabeledInput(title: "费用", text: $cost, keyboard: .decimalPad, unit: "元")
          PurchaseChannelSelectionField(channel: $channel)
        }

        Section("备注") {
          TextField("可选", text: $notes, axis: .vertical)
            .lineLimit(3...5)
        }
      }
      .navigationTitle("新增穿线记录")
      .navigationBarTitleDisplayMode(.inline)
      .editorActions(isValid: !stringName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && [cost, mainTension, crossTension].allSatisfy(NumericInput.validOptional),
        draft: [stringName, mainTension, crossTension, String(stringingDate.timeIntervalSince1970), cost, channel, notes],
        save: save)
    }
  }

  private func save() async -> Bool {
    let existing = item.racketDetails ?? RacketGearDetails()
    let record = StringingRecord(
      id: UUID(),
      stringName: RacketStringOptions.normalizedStringName(stringName),
      mainTension: Double(mainTension),
      crossTension: Double(crossTension),
      stringingDate: ISO8601DateFormatter().string(from: stringingDate),
      costCny: Double(cost),
      channel: PurchaseChannelOptions.normalizedChannel(channel),
      notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    )
    let details = existing.appendingStringingRecord(record)

    return await session.updateGearItem(
      id: item.id,
      input: GearEditInput(
        name: item.name,
        brandName: item.brand?.name,
        modelCode: item.modelCode,
        categoryName: item.resolvedCategoryName,
        gearCoverImageUrl: nil,
        profileDetails: .racket(details)
      )
    )
  }
}

private struct EditStringingRecordView: View {
  @State private var actionError: String?
  @State private var isDeleting = false

  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  let item: GearWallItem
  let record: StringingRecord

  @State private var stringName: String
  @State private var mainTension: String
  @State private var crossTension: String
  @State private var stringingDate: Date
  @State private var cost: String
  @State private var channel: String
  @State private var notes: String
  @State private var showingDeleteConfirmation = false

  private var latestItem: GearWallItem {
    session.gearWallItems.first { $0.id == item.id } ?? item
  }

  init(item: GearWallItem, record: StringingRecord) {
    self.item = item
    self.record = record
    _stringName = State(initialValue: RacketStringOptions.normalizedStringName(record.stringName) ?? "")
    _mainTension = State(initialValue: record.mainTension?.formatted(.number.precision(.fractionLength(0...1))) ?? "")
    _crossTension = State(initialValue: record.crossTension?.formatted(.number.precision(.fractionLength(0...1))) ?? "")
    _stringingDate = State(initialValue: parseISODate(record.stringingDate) ?? Date())
    _cost = State(initialValue: record.costCny?.formatted(.number.grouping(.never).precision(.fractionLength(0...2)).locale(Locale(identifier: "en_US_POSIX"))) ?? "")
    _channel = State(initialValue: record.channel ?? "")
    _notes = State(initialValue: record.notes ?? "")
  }

  var body: some View {
    NavigationStack {
      Form {
        Section("穿线记录") {
          RacketStringSelectionField(stringName: $stringName)
          LabeledInput(title: "主线磅数", text: $mainTension, keyboard: .decimalPad, unit: "lb")
          LabeledInput(title: "横线磅数", text: $crossTension, keyboard: .decimalPad, unit: "lb")
          DatePicker("穿线日期", selection: $stringingDate, displayedComponents: .date)
          LabeledInput(title: "费用", text: $cost, keyboard: .decimalPad, unit: "元")
          PurchaseChannelSelectionField(channel: $channel)
        }

        Section("备注") {
          TextField("可选", text: $notes, axis: .vertical)
            .lineLimit(3...5)
        }

        Section {
          Button("删除这条穿线记录", role: .destructive) {
            showingDeleteConfirmation = true
          }
          .foregroundStyle(SemanticTint.destructive)
        }
      }
      .disabled(isDeleting)
      .interactiveDismissDisabled(isDeleting)
      .operationFailure($actionError)
      .navigationTitle("编辑穿线记录")
      .navigationBarTitleDisplayMode(.inline)
      .editorActions(isValid: !stringName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && [cost, mainTension, crossTension].allSatisfy(NumericInput.validOptional),
        isBusy: isDeleting, draft: [stringName, mainTension, crossTension, String(stringingDate.timeIntervalSince1970), cost, channel, notes],
        save: save)
      .confirmationDialog("删除这条穿线记录？", isPresented: $showingDeleteConfirmation, titleVisibility: .visible) {
        Button("删除", role: .destructive) {
          isDeleting = true
          Task {
            defer { isDeleting = false }
            if await delete() { dismiss() } else { actionError = session.errorMessage }
          }
        }
      } message: {
        Text("删除后，当前球线会自动切换为剩余历史中最近的一条。")
      }
    }
  }

  private func save() async -> Bool {
    let existing = latestItem.racketDetails ?? RacketGearDetails()
    let updatedRecord = StringingRecord(
      id: record.id,
      stringName: RacketStringOptions.normalizedStringName(stringName),
      mainTension: Double(mainTension),
      crossTension: Double(crossTension),
      stringingDate: ISO8601DateFormatter().string(from: stringingDate),
      costCny: Double(cost),
      channel: PurchaseChannelOptions.normalizedChannel(channel),
      notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
    )
    let details = existing.replacingStringingRecord(updatedRecord)
    return await updateRacketDetails(details)
  }

  private func delete() async -> Bool {
    let existing = latestItem.racketDetails ?? RacketGearDetails()
    let details = existing.removingStringingRecord(id: record.id)
    return await updateRacketDetails(details)
  }

  private func updateRacketDetails(_ details: RacketGearDetails) async -> Bool {
    await session.updateGearItem(
      id: latestItem.id,
      input: GearEditInput(
        name: latestItem.name,
        brandName: latestItem.brand?.name,
        modelCode: latestItem.modelCode,
        categoryName: latestItem.resolvedCategoryName,
        gearCoverImageUrl: nil,
        profileDetails: .racket(details)
      )
    )
  }
}

private struct GearDetailMetricItem: Identifiable {
  let title: String
  let value: String

  var id: String { title }
}

private struct GearProfileDetailSection: View {
  let item: GearWallItem
  let purchaseRecords: [PurchaseRecord]
  var onAddStringingRecord: (() -> Void)? = nil
  var onEditStringingRecord: ((StringingRecord) -> Void)? = nil

  var body: some View {
    switch item.categoryBucket {
    case .shuttle:
      shuttleSection
    case .racket:
      racketSection
    case .shoes:
      shoesSection
    case .all, .other:
      EmptyView()
    }
  }

  private var shuttleSection: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("羽毛球档案")
        .font(.headline)

      VStack(spacing: 0) {
        GearDetailRow(title: "每筒数量", value: item.shuttleDetails?.ballsPerTube.map { "\($0) 只" } ?? "未记录")
        Divider()
        GearDetailRow(title: "速度号", value: item.shuttleDetails?.speed?.nilIfEmpty ?? "未记录")
      }
      .padding(.horizontal, 14)
      .appSurface()

      if purchaseRecords.count > 1 {
        ShuttleItemTrendCard(records: purchaseRecords)
      }
    }
  }

  private var racketSection: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("球拍档案")
        .font(.headline)

      VStack(spacing: 0) {
        GearDetailRow(title: "重量规格", value: item.racketDetails?.weightSpec?.nilIfEmpty ?? "未记录")
        Divider()
        GearDetailRow(title: "手柄规格", value: item.racketDetails?.gripSpec?.nilIfEmpty ?? "未记录")
        Divider()
        GearDetailRow(title: "当前球线", value: item.racketDetails?.currentString?.nilIfEmpty ?? "未记录")
        Divider()
        GearDetailRow(title: "磅数", value: tensionText(main: item.racketDetails?.mainTension, cross: item.racketDetails?.crossTension) ?? "未记录")
        Divider()
        GearDetailRow(title: "穿线日期", value: item.racketDetails?.stringingDate.map(shortDate) ?? "未记录")
      }
      .padding(.horizontal, 14)
      .appSurface()

      if let history = item.racketDetails?.stringHistory, !history.isEmpty {
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Text("球线历史")
              .font(.subheadline.weight(.semibold))
            Spacer()
            if let onAddStringingRecord {
              Button(action: onAddStringingRecord) {
                Label("新增", systemImage: "plus")
              }
              .font(.subheadline.weight(.semibold))
            }
          }
          ForEach(history.sorted { ($0.stringingDate ?? "") > ($1.stringingDate ?? "") }) { record in
            Button {
              onEditStringingRecord?(record)
            } label: {
              HStack {
                VStack(alignment: .leading, spacing: 3) {
                  Text(record.stringName?.nilIfEmpty ?? "未记录球线")
                    .font(.subheadline.weight(.semibold))
                  Text(record.stringingDate.map(shortDate) ?? "未记录日期")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                Spacer(minLength: 12)
                VStack(alignment: .trailing, spacing: 3) {
                  Text(tensionText(main: record.mainTension, cross: record.crossTension) ?? "未记录")
                    .font(.subheadline.weight(.medium))
                  Text(record.secondarySummary)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                }
                if onEditStringingRecord != nil {
                  Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
                }
              }
              .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(12)
            .appSurface(.compact)
            .disabled(onEditStringingRecord == nil)
          }
        }
        if let history = item.racketDetails?.stringHistory, history.filter({ $0.costCny != nil }).count > 1 {
          StringingCostTrendCard(records: history)
        }
      } else if let onAddStringingRecord {
        Button {
          onAddStringingRecord()
        } label: {
          Label("新增穿线记录", systemImage: "plus")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .controlSize(.large)
      }
    }
  }

  private var shoesSection: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("球鞋档案")
        .font(.headline)

      VStack(spacing: 0) {
        GearDetailRow(title: "尺码", value: item.shoesSizeSummary ?? "未记录")
        Divider()
        GearDetailRow(title: "配色", value: item.shoesDetails?.colorway?.nilIfEmpty ?? "未记录")
        Divider()
        GearDetailRow(title: "状态", value: item.ownershipStatusText)
      }
      .padding(.horizontal, 14)
      .appSurface()
    }
  }
}

private struct ShuttleItemTrendCard: View {
  @Environment(\.appAccentColor) private var accent
  let records: [PurchaseRecord]

  var body: some View {
    let series = PurchaseTrendSeries(records: records)
    let pricePoints = series.points.filter { $0.price != nil }
    let quantityScale = AnalyticsYAxisScale.make(
      maxValue: Double(series.points.map(\.quantity).max() ?? 0), forceIntegerSteps: true
    )
    VStack(alignment: .leading, spacing: 14) {
      Text("单品购买趋势")
        .font(.subheadline.weight(.semibold))

      if series.points.isEmpty {
        Text("暂无有效购买日期")
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, minHeight: 140)
      } else {
        VStack(alignment: .leading, spacing: 8) {
          Text("购买量")
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
          GeometryReader { geometry in
            Chart(series.points) { point in
              BarMark(
                x: .value("购买日期", point.date),
                y: .value("数量", point.quantity),
                width: .fixed(series.barWidth(plotWidth: geometry.size.width - 44))
              )
              .foregroundStyle(.green)
              .cornerRadius(3)
              .accessibilityLabel(point.date.formatted(date: .abbreviated, time: .omitted))
              .accessibilityValue("购买 \(point.quantity)")
            }
            .chartXScale(domain: series.domain)
            .chartXAxis { purchaseTrendDateAxis(spansYears: series.spansYears) }
            .chartYScale(domain: quantityScale.domain)
            .chartYAxis {
              AxisMarks(position: .leading, values: quantityScale.marks)
            }
          }
          .frame(height: 140)
        }

        if !pricePoints.isEmpty {
          VStack(alignment: .leading, spacing: 8) {
            Text("当日平均单价")
              .font(.caption.weight(.semibold))
              .foregroundStyle(.secondary)
            Chart(pricePoints) { point in
              if let price = point.price {
                LineMark(x: .value("购买日期", point.date), y: .value("单价", price))
                  .interpolationMethod(.linear)
                  .foregroundStyle(accent)
                PointMark(x: .value("购买日期", point.date), y: .value("单价", price))
                  .foregroundStyle(accent)
                  .accessibilityLabel(point.date.formatted(date: .abbreviated, time: .omitted))
                  .accessibilityValue(money(price))
              }
            }
            .chartXScale(domain: series.domain)
            .chartXAxis { purchaseTrendDateAxis(spansYears: series.spansYears) }
            .chartYAxis { AxisMarks(position: .leading) }
            .frame(height: 150)
          }
        }
      }
    }
    .padding(12)
    .appSurface()
  }
}

private func purchaseTrendDateAxis(spansYears: Bool) -> some AxisContent {
  AxisMarks(values: .automatic(desiredCount: 4)) { value in
    AxisGridLine()
    AxisTick()
    AxisValueLabel {
      if let date = value.as(Date.self) {
        Text(date, format: spansYears
          ? .dateTime.year(.twoDigits).month(.twoDigits).day(.twoDigits)
          : .dateTime.month(.twoDigits).day(.twoDigits))
          .font(.caption2)
      }
    }
  }
}

private struct StringingCostTrendCard: View {
  let records: [StringingRecord]

  private var points: [StringingCostPoint] {
    records
      .filter { $0.costCny != nil }
      .sorted { ($0.stringingDate ?? "") < ($1.stringingDate ?? "") }
      .enumerated()
      .compactMap { index, record in
        guard let cost = record.costCny else { return nil }
        return StringingCostPoint(
          id: record.id,
          index: index + 1,
          date: record.stringingDate.map(shortDate) ?? "未记录",
          cost: cost
        )
      }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("穿线价格变化")
        .font(.subheadline.weight(.semibold))

      Chart(points) { point in
        LineMark(
          x: .value("穿线", point.index),
          y: .value("价格", point.cost)
        )
        .interpolationMethod(.linear)
        .foregroundStyle(.orange)

        PointMark(
          x: .value("穿线", point.index),
          y: .value("价格", point.cost)
        )
        .foregroundStyle(.orange)
      }
      .chartXScale(domain: 0.5...Double(max(points.count, 1)) + 0.5)
      .chartXAxis {
        AxisMarks(values: points.map(\.index)) { value in
          AxisValueLabel {
            if let index = value.as(Int.self),
               let point = points.first(where: { $0.index == index }) {
              Text(point.date)
                .font(.caption2)
            }
          }
        }
      }
      .chartYAxis {
        AxisMarks(position: .leading) { value in
          AxisGridLine()
          AxisValueLabel {
            if let amount = value.as(Double.self) {
              Text(money(amount))
            }
          }
        }
      }
      .frame(height: 160)
      .padding(12)
      .appSurface()
    }
  }
}

private struct StringingCostPoint: Identifiable {
  let id: UUID
  let index: Int
  let date: String
  let cost: Double
}

private extension StringingRecord {
  var secondarySummary: String {
    let costText = costCny.map(money)
    let channelText = channel.flatMap(PurchaseChannelOptions.normalizedChannel)
    let summary = [costText, channelText].compactMap { $0?.nilIfEmpty }.joined(separator: " / ")
    return summary.isEmpty ? "未记录费用" : summary
  }
}

private struct GearDetailMetric: View {
  let title: String
  let value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(LocalizedStringKey(title))
        .font(.caption)
        .foregroundStyle(.secondary)
      Text(value)
        .font(.headline.weight(.semibold))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(14)
    .appSurface(.compact)
  }
}

private struct PurchaseRecordCard: View {
  let purchase: PurchaseRecord

  var body: some View {
    AdaptiveRow(spacing: 12) {
      VStack(alignment: .leading, spacing: 6) {
        Text("购买 \(shortDate(purchase.purchaseDate))")
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(.primary)
        Text(purchase.secondarySummary)
          .font(.caption)
          .foregroundStyle(.secondary)
          .fixedSize(horizontal: false, vertical: true)
      }

      Spacer(minLength: 8)

      VStack(alignment: .trailing, spacing: 6) {
        Text(money(purchase.totalPriceCny))
          .font(.subheadline.weight(.bold))
          .foregroundStyle(.primary)
        StatusPill(text: purchase.inventoryStatusText, color: purchase.inventoryTint, systemImage: purchase.inventorySymbol)
      }

      Image(systemName: "chevron.right")
        .font(.caption.weight(.semibold))
        .foregroundStyle(.tertiary)
        .padding(.top, 3)
    }
    .padding(14)
    .appSurface()
  }
}

private struct GearDetailRow: View {
  let title: String
  let value: String

  var body: some View {
    AdaptiveRow {
      Text(LocalizedStringKey(title))
        .foregroundStyle(.secondary)
      Spacer(minLength: 16)
      Text(value)
        .fontWeight(.medium)
    }
    .font(.subheadline)
    .padding(.vertical, 13)
  }
}

private struct GearWallCard: View {
  let item: GearWallItem

  private var scoreText: String? {
    guard let score = item.ratings.first?.overall else { return nil }
    return score.formatted(.number.precision(.fractionLength(1)))
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      RemoteImageView(
        url: GearImageResolver.preferredImageURL(imageKey: item.imageKey, coverImageUrl: item.coverImageUrl),
        systemImage: "photo",
        imageKey: item.imageKey,
        coverImageUrl: item.coverImageUrl,
        categoryName: item.resolvedCategoryName
      )
      .aspectRatio(1, contentMode: .fit)
      .frame(maxWidth: .infinity)
      .overlay(alignment: .topTrailing) {
        if let scoreText {
          Label(scoreText, systemImage: "star.fill")
            .font(.caption.weight(.bold))
            .foregroundStyle(.orange)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(.regularMaterial, in: Capsule())
            .padding(6)
            .accessibilityLabel("评分 \(scoreText)")
        }
      }

      VStack(alignment: .leading, spacing: 7) {
        Text(item.compactDisplayName)
          .font(.subheadline.weight(.bold))
          .lineLimit(2, reservesSpace: true)
          .frame(maxWidth: .infinity, alignment: .leading)
          .accessibilityLabel(item.displayName)

        Text(item.metaText)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1, reservesSpace: true)

        VStack(alignment: .leading, spacing: 2) {
          Text(money(item.referenceUnitPriceCny))
            .font(.subheadline.weight(.semibold))
            .lineLimit(1, reservesSpace: true)
          Text(item.cardSummaryText ?? " ")
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1, reservesSpace: true)
            .accessibilityHidden(item.cardSummaryText == nil)
        }

        GearCardPills(pills: Array(item.statusPills.prefix(4)))
      }
    }
    .padding(12)
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .appSurface()
  }
}

private struct GearCardPills: View {
  let pills: [GearWallPill]
  private let columns = [
    GridItem(.flexible(minimum: 0), spacing: 6, alignment: .leading),
    GridItem(.flexible(minimum: 0), spacing: 6, alignment: .leading)
  ]

  var body: some View {
    // Four slots reserve two rows even when an item has fewer attributes.
    LazyVGrid(columns: columns, alignment: .leading, spacing: 6) {
      ForEach(0..<4, id: \.self) { index in
        if index < pills.count {
          StatusPill(text: pills[index].text, color: pills[index].color)
            .lineLimit(1, reservesSpace: true)
        } else {
          StatusPill(text: " ")
            .lineLimit(1, reservesSpace: true)
            .hidden()
            .accessibilityHidden(true)
        }
      }
    }
  }
}

#if DEBUG
#Preview("装备卡片 · 名称与标签") {
  ScrollView {
    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
      ForEach(PreviewData.gearWallItems) { GearWallCard(item: $0) }
      GearWallCard(item: GearWallItem(
        id: "preview-minimal", name: "训练球", coverImageUrl: nil, imageKey: nil,
        modelCode: nil, createdAt: nil, latestPurchaseDate: nil, referenceUnitPriceCny: 80,
        brand: nil, category: PreviewData.categoryShuttle, profileDetails: nil,
        ratings: [], totalQuantity: 1, activeQuantity: 1, usedUpQuantity: 0, wornOutQuantity: 0
      ))
      GearWallCard(item: GearWallItem(
        id: "preview-long", name: "专业比赛训练羽毛球超长名称限定纪念版本", coverImageUrl: nil, imageKey: nil,
        modelCode: nil, createdAt: nil, latestPurchaseDate: nil, referenceUnitPriceCny: 128,
        brand: nil, category: PreviewData.categoryShuttle,
        profileDetails: .shuttle(ShuttleGearDetails(ballsPerTube: 12, speed: "77")),
        ratings: [], totalQuantity: 8, activeQuantity: 6, usedUpQuantity: 2, wornOutQuantity: 0
      ))
    }
    .padding()
  }
  .background(Color(.systemGroupedBackground))
}

#Preview("装备卡片 · 大字号") {
  ScrollView {
    VStack(spacing: 14) {
      ForEach(PreviewData.gearWallItems) { GearWallCard(item: $0) }
    }
    .padding()
  }
  .environment(\.dynamicTypeSize, .accessibility3)
  .background(Color(.systemGroupedBackground))
}
#endif

private enum GearArchiveView: String, CaseIterable, Identifiable {
  case wall
  case pegboard

  var id: String { rawValue }

  var label: String {
    switch self {
    case .wall: "清单"
    case .pegboard: "洞洞板"
    }
  }

  var systemImage: String {
    switch self {
    case .wall: "square.grid.2x2"
    case .pegboard: "circle.grid.cross"
    }
  }
}

private enum GearWallCategory: String, CaseIterable, Identifiable {
  case all
  case shuttle
  case shoes
  case racket
  case other

  var id: String { rawValue }

  var label: String {
    switch self {
    case .all: "全部"
    case .shuttle: "羽毛球"
    case .shoes: "球鞋"
    case .racket: "球拍"
    case .other: "其他"
    }
  }

  func matches(_ item: GearWallItem) -> Bool {
    self == .all || item.categoryBucket == self
  }
}

private enum GearWallSort: String, CaseIterable, Identifiable {
  case recentPurchase
  case rating
  case priceHigh
  case priceLow
  case createdNewest
  case createdOldest
  case brand

  var id: String { rawValue }

  var label: String {
    switch self {
    case .recentPurchase: "最近购买"
    case .rating: "评分最高"
    case .priceHigh: "价格从高到低"
    case .priceLow: "价格从低到高"
    case .createdNewest: "录入最新"
    case .createdOldest: "录入最早"
    case .brand: "品牌排序"
    }
  }

  func callAsFunction(_ left: GearWallItem, _ right: GearWallItem) -> Bool {
    switch self {
    case .recentPurchase:
      return left.latestPurchaseSortDate > right.latestPurchaseSortDate
    case .rating:
      return left.ratingValue > right.ratingValue
    case .priceHigh:
      return (left.referenceUnitPriceCny ?? -1) > (right.referenceUnitPriceCny ?? -1)
    case .priceLow:
      return (left.referenceUnitPriceCny ?? Double.greatestFiniteMagnitude) < (right.referenceUnitPriceCny ?? Double.greatestFiniteMagnitude)
    case .createdNewest:
      return left.createdSortDate > right.createdSortDate
    case .createdOldest:
      return left.createdSortDate < right.createdSortDate
    case .brand:
      return (left.brand?.name ?? "").localizedCaseInsensitiveCompare(right.brand?.name ?? "") == .orderedAscending
    }
  }
}

private struct GearWallPill: Identifiable {
  let text: String
  let color: Color

  var id: String { text }
}

private extension GearWallItem {
  var searchText: String {
    [displayName, name, brand?.name, category?.name, modelCode].compactMap { $0 }.joined(separator: " ")
  }

  var resolvedCategoryName: String {
    if let categoryName = category?.name, !categoryName.isEmpty {
      return categoryName
    }
    let seed = searchText.lowercased()
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

  var isRacket: Bool {
    resolvedCategoryName.contains("球拍")
  }

  var historicalQuantity: Int {
    if resolvedCategoryName.contains("羽毛球") {
      return max(0, usedUpQuantity)
    }
    if resolvedCategoryName.contains("球拍") || resolvedCategoryName.contains("球鞋") {
      return max(0, wornOutQuantity)
    }
    return 0
  }

  var categoryBucket: GearWallCategory {
    let categoryName = resolvedCategoryName
    if categoryName.contains("羽毛球") { return .shuttle }
    if categoryName.contains("球鞋") { return .shoes }
    if categoryName.contains("球拍") { return .racket }
    return .other
  }

  var metaText: String {
    [brand?.name, modelCode, category?.name].compactMap { $0 }.joined(separator: " / ")
  }

  var compactDisplayName: String { displayName }

  var ratingValue: Double {
    ratings.first?.overall ?? -1
  }

  var latestPurchaseSortDate: Date {
    parseISODate(latestPurchaseDate) ?? .distantPast
  }

  var createdSortDate: Date {
    parseISODate(createdAt) ?? .distantPast
  }

  var statusPills: [GearWallPill] {
    if categoryBucket == .shuttle {
      var pills = [
        GearWallPill(text: category?.name ?? "羽毛球", color: .gray),
        GearWallPill(text: isLowOnShuttles ? "仅剩1筒" : "库存 \(stockQuantity)",
          color: isLowOnShuttles ? SemanticTint.stored : SemanticTint.active)
      ]
      if let speed = shuttleDetails?.speed, !speed.isEmpty {
        pills.append(GearWallPill(text: "速度 \(speed)", color: .blue))
      }
      if let ballsPerTube = shuttleDetails?.ballsPerTube, ballsPerTube > 0 {
        pills.append(GearWallPill(text: "\(ballsPerTube) 只/筒", color: .teal))
      }
      if usedUpQuantity > 0 {
        pills.append(GearWallPill(text: "用完 \(usedUpQuantity)", color: SemanticTint.consumed))
      }
      return pills
    }

    if categoryBucket == .racket {
      return [
        GearWallPill(text: category?.name ?? "球拍", color: .gray),
        GearWallPill(text: ownershipStatusText, color: ownershipStatusColor),
        racketStringSummary.map { GearWallPill(text: $0, color: .blue) },
        racketSpecSummary.map { GearWallPill(text: $0, color: .purple) }
      ].compactMap { $0 }
    }

    if categoryBucket == .shoes {
      return [
        GearWallPill(text: category?.name ?? "球鞋", color: .gray),
        GearWallPill(text: ownershipStatusText, color: ownershipStatusColor),
        shoesSizeSummary.map { GearWallPill(text: $0, color: .blue) },
        shoesDetails?.colorway?.nilIfEmpty.map { GearWallPill(text: $0, color: .purple) }
      ].compactMap { $0 }
    }

    return [
      GearWallPill(text: category?.name ?? "其他", color: .gray),
      GearWallPill(text: ownershipStatusText, color: ownershipStatusColor)
    ]
  }

  var cardSummaryText: String? {
    if categoryBucket == .racket {
      return racketStringSummary ?? latestPurchaseSummary
    }
    if categoryBucket == .shoes {
      return shoesSizeSummary ?? latestPurchaseSummary
    }
    if categoryBucket == .shuttle {
      return latestPurchaseSummary
    }
    return latestPurchaseSummary
  }

  var latestPurchaseSummary: String? {
    latestPurchaseDate.map { "最近购买 \(shortDate($0))" }
  }

  var ownershipStatusText: String {
    if activeQuantity > 0 { return "在用" }
    if wornOutQuantity > 0 { return "退役" }
    if usedUpQuantity > 0 { return "已用完" }
    return "闲置"
  }

  var ownershipStatusColor: Color {
    if activeQuantity > 0 { return SemanticTint.active }
    if wornOutQuantity > 0 { return SemanticTint.retired }
    if usedUpQuantity > 0 { return SemanticTint.consumed }
    return SemanticTint.stored
  }

  var shuttleDetails: ShuttleGearDetails? {
    guard case .shuttle(let details) = profileDetails else { return nil }
    return details
  }

  var racketDetails: RacketGearDetails? {
    guard case .racket(let details) = profileDetails else { return nil }
    return details
  }

  var shoesDetails: ShoesGearDetails? {
    guard case .shoes(let details) = profileDetails else { return nil }
    return details
  }

  var racketStringSummary: String? {
    guard let details = racketDetails else { return nil }
    let stringName = details.currentString?.nilIfEmpty
    let tension = tensionText(main: details.mainTension, cross: details.crossTension)
    return [stringName, tension].compactMap { $0 }.joined(separator: " / ").nilIfEmpty
  }

  var racketSpecSummary: String? {
    guard let details = racketDetails else { return nil }
    return [details.weightSpec?.nilIfEmpty, details.gripSpec?.nilIfEmpty].compactMap { $0 }.joined(separator: " / ").nilIfEmpty
  }

  var shoesSizeSummary: String? {
    guard let details = shoesDetails, let size = details.size?.nilIfEmpty else { return nil }
    return [details.sizeSystem?.nilIfEmpty, size].compactMap { $0 }.joined(separator: " ")
  }
}

private extension PurchaseRecord {
  var purchaseSortDate: Date {
    parseISODate(purchaseDate) ?? .distantPast
  }

  var secondarySummary: String {
    var parts = [purchaseStatusDateText]
    parts.append(PurchaseChannelOptions.normalizedChannel(channel))
    parts.append("数量 \(quantity)")
    return parts.compactMap { $0?.nilIfEmpty }.joined(separator: " / ")
  }

  var purchaseStatusDateText: String? {
    guard itemStatus.needsStatusDate, let statusDate else { return nil }
    return "\(itemStatus.statusDateLabel) \(shortDate(statusDate))"
  }

  func matchesGearItem(_ item: GearWallItem) -> Bool {
    LocalGearIdentity.id(for: self) == item.id
  }
}

private func parseISODate(_ rawValue: String?) -> Date? {
  AppDate.parseISODate(rawValue)
}

private func tensionText(main: Double?, cross: Double?) -> String? {
  guard main != nil || cross != nil else { return nil }
  let mainText = main.map(formatTension) ?? "-"
  let crossText = cross.map(formatTension) ?? "-"
  return "\(mainText)/\(crossText) 磅"
}

private func formatTension(_ value: Double) -> String {
  value.formatted(.number.precision(.fractionLength(0...1)))
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
