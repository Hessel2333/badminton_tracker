import SwiftUI

struct PurchaseDeleteButton: View {
  @Environment(AppSession.self) private var session
  @Environment(\.dismiss) private var dismiss
  let purchase: PurchaseRecord
  @Binding var isDeleting: Bool
  @State private var showingConfirmation = false
  @State private var failure: String?

  private var confirmationMessage: String {
    let identity = LocalGearIdentity.id(for: purchase)
    let isLastPurchase = session.purchases.filter { LocalGearIdentity.id(for: $0) == identity }.count == 1
    if isLastPurchase {
      return "这是这件装备的最后一笔购买，删除后将一并移除装备档案。删除后可短暂撤销。"
    }
    return "这笔购买及其消耗记录会被删除，库存与支出将同步更新。删除后可短暂撤销。"
  }

  var body: some View {
    Button(role: .destructive) { showingConfirmation = true } label: {
      HStack(spacing: 10) {
        Label("删除这条购买记录", systemImage: "trash")
        Spacer(minLength: 0)
        if isDeleting { ProgressView().accessibilityLabel("正在删除") }
      }
      .frame(minHeight: 44)
      .foregroundStyle(SemanticTint.destructive)
    }
    .disabled(isDeleting)
    .accessibilityIdentifier("purchase.delete")
    .confirmationDialog("删除这条购买记录？", isPresented: $showingConfirmation, titleVisibility: .visible) {
      Button("删除记录", role: .destructive) {
        guard !isDeleting else { return }
        isDeleting = true
        Task { @MainActor in
          defer { isDeleting = false }
          if await session.deletePurchaseRecord(id: purchase.id) { dismiss() }
          else { failure = session.errorMessage ?? "未能删除，请重试。" }
        }
      }
      Button("取消", role: .cancel) { }
    } message: {
      Text(LocalizedStringKey(confirmationMessage))
    }
    .operationFailure($failure)
  }
}
