import SwiftUI

struct DashboardView: View {
  @Environment(AppSession.self) private var session
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @State private var showingPurchase = false

  private var totalSpend: Double {
    session.spendingEntries.reduce(0) { $0 + ($1.amount ?? 0) }
  }

  private var activeCount: Int {
    session.purchases.filter { $0.itemStatus == .inUse }.reduce(0) { $0 + $1.remainingQuantity }
  }

  private var storedCount: Int {
    session.purchases.filter { $0.itemStatus == .stored }.reduce(0) { $0 + $1.remainingQuantity }
  }

  private var activeWishlistItems: [WishlistItem] {
    session.wishlistItems.filter { $0.status.isActive }
  }

  var body: some View {
    ScrollView {
      VStack(spacing: 16) {
        if let message = session.errorMessage {
          ErrorBanner(message: message)
        }

        if session.isLoading && !session.hasLoadedInitialData {
          LoadingStateView(title: "正在读取本地数据", message: "购买、装备、心愿和分析数据都会保存在这台设备上。")
            .padding(.horizontal)
        } else if !session.hasLoadedInitialData, session.errorMessage != nil {
          Button("重新读取") { Task { await session.refreshAll() } }
            .buttonStyle(.borderedProminent).controlSize(.large)
        } else if session.purchases.isEmpty {
          EmptyStateView(title: "从第一件装备开始", message: "记录购买，随时查看装备、库存和花费。",
            systemImage: "bag", actionTitle: "记录第一件装备", action: { showingPurchase = true })
            .padding(.horizontal)
          NavigationLink("从备份恢复") { AppSettingsView() }
            .frame(minHeight: 44)
        } else {
          LazyVGrid(columns: dynamicTypeSize.isAccessibilitySize ? [GridItem(.flexible())] : [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            NavigationLink { AnalyticsPurchaseList(filter: nil) } label: { MetricCard(title: "累计投入", value: money(totalSpend), footnote: "含装备购买与穿线") }
            NavigationLink { DashboardRecordsView(title: "在用装备", status: .inUse) } label: { MetricCard(title: "在用装备", value: "\(activeCount)", footnote: "当前可用") }
            NavigationLink { DashboardRecordsView(title: "闲置库存", status: .stored) } label: { MetricCard(title: "闲置库存", value: "\(storedCount)", footnote: "待整理") }
            NavigationLink { WishlistView() } label: { MetricCard(
              title: "心愿目标",
              value: money(activeWishlistItems.compactMap(\.targetPriceCny).reduce(0, +)),
              footnote: String(localized: "\(activeWishlistItems.count) 个目标", bundle: AppLanguage.bundle, locale: AppLanguage.locale)
            ) }
          }
          .buttonStyle(.plain)
          .padding(.horizontal)
        }

        if !session.purchases.isEmpty {
        VStack(alignment: .leading, spacing: 12) {
          Text("最近变化")
            .font(.headline)
          if session.purchases.isEmpty {
            EmptyStateView(title: "暂无购买记录", message: "新增第一条购买记录后，这里会自动出现最近变化。", systemImage: "tray")
          } else {
            ForEach(session.purchases.prefix(5)) { purchase in
              NavigationLink { AnalyticsPurchaseDetail(purchaseID: purchase.id) } label: { PurchaseRow(purchase: purchase) }.buttonStyle(.plain)
            }
          }
        }
        .padding()
        .appSurface()
        .padding(.horizontal)
        }
      }
      .padding(.bottom, 24)
      .padding(.top, 12)
    }
    .background(Color(.systemGroupedBackground))
    .navigationTitle("总览")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      if !session.purchases.isEmpty {
        ToolbarItem(placement: .topBarTrailing) {
          Button { showingPurchase = true } label: {
            Label("记录购买", systemImage: "plus")
          }
          .labelStyle(.iconOnly)
        }
      }
    }
    .sheet(isPresented: $showingPurchase) { AddPurchaseView() }
  }
}

struct DashboardRecordsView: View {
  @Environment(AppSession.self) private var session
  let title: String
  let status: ItemStatus?
  var body: some View {
    List {
      let records = session.purchases.filter { status == nil || ($0.itemStatus == status && $0.remainingQuantity > 0) }
      if records.isEmpty { ContentUnavailableView("暂无购买记录", systemImage: "bag") }
      ForEach(records) { purchase in
        NavigationLink { AnalyticsPurchaseDetail(purchaseID: purchase.id) } label: { PurchaseRow(purchase: purchase) }
      }
    }
    .navigationTitle(Text(LocalizedStringKey(title)))
  }
}
