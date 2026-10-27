import SwiftUI

struct QuickConsumptionView: View {
  @Environment(AppSession.self) private var session
  let purchases: [PurchaseRecord]
  @State private var purchaseID: String
  @State private var quantity = 1
  @State private var finishedDate = Date()
  @State private var startedDate = Date()
  @State private var includesStart = false

  init(purchases: [PurchaseRecord]) {
    self.purchases = purchases
    _purchaseID = State(initialValue: purchases.first?.id ?? "")
  }

  private var purchase: PurchaseRecord? {
    session.purchases.first { $0.id == purchaseID }
  }
  private var earliest: Date {
    min(AppDate.parseISODate(purchase?.purchaseDate) ?? Date(), Date())
  }

  var body: some View {
    NavigationStack {
      Form {
        Section("购买批次") {
          Picker("批次", selection: $purchaseID) {
            ForEach(purchases) { item in
              Text("\(shortDate(item.purchaseDate)) · 剩余 \(item.remainingQuantity)").tag(item.id)
            }
          }
        }
        Section("本次用完") {
          Stepper("数量 \(quantity)", value: $quantity, in: 1...max(1, purchase?.remainingQuantity ?? 0))
          DatePicker("用完日期", selection: $finishedDate, in: earliest...Date(), displayedComponents: .date)
          Toggle("记录启用日期", isOn: $includesStart)
          if includesStart {
            DatePicker("启用日期", selection: $startedDate, in: earliest...max(earliest, finishedDate), displayedComponents: .date)
          }
          LabeledContent("记录后剩余", value: "\(max(0, (purchase?.remainingQuantity ?? 0) - quantity))")
        }
      }
      .navigationTitle("记录消耗")
      .navigationBarTitleDisplayMode(.inline)
      .onChange(of: purchaseID) { _, _ in
        quantity = min(quantity, max(1, purchase?.remainingQuantity ?? 0))
        finishedDate = max(earliest, finishedDate)
        startedDate = max(earliest, min(startedDate, finishedDate))
      }
      .onChange(of: finishedDate) { _, value in startedDate = max(earliest, min(startedDate, value)) }
      .editorActions(isValid: (purchase?.remainingQuantity ?? 0) >= quantity,
        draft: [purchaseID, String(quantity), String(finishedDate.timeIntervalSince1970),
                String(startedDate.timeIntervalSince1970), String(includesStart)]) {
        guard let purchase else {
          session.errorMessage = "这条购买记录已不存在，请重新选择。"
          return false
        }
        let record = ConsumptionRecord(quantity: quantity,
          finishedDate: ISO8601DateFormatter().string(from: finishedDate),
          startedDate: includesStart ? ISO8601DateFormatter().string(from: startedDate) : nil)
        let saved = await session.updatePurchaseRecord(id: purchase.id, input: PurchaseEditInput(
          consumptionRecords: purchase.consumptionHistory + [record],
          unitPriceCny: purchase.unitPriceCny, quantity: purchase.quantity,
          purchaseDate: purchase.purchaseDate, statusDate: purchase.statusDate,
          channel: purchase.channel, itemStatus: purchase.itemStatus, notes: purchase.notes))
        if saved { session.undoOperation = .consumption(purchaseID: purchase.id, recordID: record.id, originalStatus: purchase.itemStatus) }
        return saved
      }
    }
  }
}

struct ConsumptionSection: View {
  let records: [ConsumptionRecord]
  let quantity: Int
  let onAdd: () -> Void
  let onUndo: (ConsumptionRecord) -> Void

  private var consumed: Int { records.reduce(0) { $0 + $1.quantity } }
  private var remaining: Int { max(0, quantity - consumed) }

  var body: some View {
    Section {
      LabeledContent("已用完 / 剩余", value: "\(consumed) / \(remaining)")
      ForEach(records.sorted { ($0.finishedDate ?? "") > ($1.finishedDate ?? "") }) { record in
        HStack {
          VStack(alignment: .leading, spacing: 5) {
            Text("用完 \(record.quantity)")
              .font(.body.weight(.medium))
            if let date = AppDate.parseISODate(record.finishedDate) {
              Text(date, style: .date).font(.subheadline).foregroundStyle(.secondary)
            } else {
              Text("未记录用完日期").font(.subheadline).foregroundStyle(.secondary)
            }
            if let days = record.usageDays {
              Text("使用 \(days) 天").font(.caption).foregroundStyle(.secondary)
            }
          }
          Spacer()
          Button(role: .destructive) { onUndo(record) } label: {
            Image(systemName: "minus.circle")
          }
          .buttonStyle(.borderless)
          .tint(SemanticTint.destructive)
          .accessibilityLabel("撤销用完 \(record.quantity) 的记录")
        }
      }
      if remaining > 0 {
        Button(action: onAdd) {
          Label("记录消耗", systemImage: "minus.circle")
        }
        .tint(SemanticTint.consumption)
      }
    } header: {
      Text("消耗记录")
    } footer: {
      Text("修改后点击右上角“保存”。填写启用日期可查看该批装备的使用天数。")
    }

  }
}

struct ConsumptionEntryRequest: Identifiable {
  let id = UUID()
  let maximum: Int
  let purchaseDate: Date
}

struct ConsumptionEntryView: View {
  @Environment(\.dismiss) private var dismiss
  let maximum: Int
  let purchaseDate: Date
  let onAdd: (ConsumptionRecord) -> Void
  @State private var quantity = 1
  @State private var finishedDate = Date()
  @State private var startedDate = Date()
  @State private var includesStart = false

  private var earliest: Date { min(Calendar.current.startOfDay(for: purchaseDate), Date()) }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Stepper("用完数量 \(quantity)", value: $quantity, in: 1...max(1, maximum))
          DatePicker("用完日期", selection: $finishedDate, in: earliest...Date(), displayedComponents: .date)
          Toggle("记录启用日期", isOn: $includesStart)
          if includesStart {
            DatePicker("启用日期", selection: $startedDate, in: earliest...finishedDate, displayedComponents: .date)
          }
        }
      }
      .navigationTitle("记录消耗")
      .navigationBarTitleDisplayMode(.inline)
      .onChange(of: finishedDate) { _, date in startedDate = min(startedDate, date) }
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) {
          Button("添加") {
            let formatter = ISO8601DateFormatter()
            onAdd(ConsumptionRecord(quantity: quantity,
              finishedDate: formatter.string(from: finishedDate),
              startedDate: includesStart ? formatter.string(from: min(startedDate, finishedDate)) : nil))
            dismiss()
          }
        }
      }
    }
  }
}

struct ConsumptionHistoryCard: View {
  let purchases: [PurchaseRecord]

  private var records: [ConsumptionRecord] {
    purchases.flatMap(\.consumptionHistory)
      .sorted { ($0.finishedDate ?? "") > ($1.finishedDate ?? "") }
  }
  private var monthlyQuantity: Int {
    records.filter {
      guard let date = AppDate.parseISODate($0.finishedDate) else { return false }
      return Calendar.current.isDate(date, equalTo: Date(), toGranularity: .month)
    }.reduce(0) { $0 + $1.quantity }
  }

  var body: some View {
    if !records.isEmpty {
      VStack(alignment: .leading, spacing: 12) {
        HStack {
          Text("消耗历史").font(.headline)
          Spacer()
          Text("本月用完 \(monthlyQuantity)").font(.subheadline).foregroundStyle(.secondary)
        }
        ForEach(records) { record in
          HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
              Text("用完 \(record.quantity)")
              if let date = AppDate.parseISODate(record.finishedDate) {
                Text(date, style: .date).font(.caption).foregroundStyle(.secondary)
              } else {
                Text("未记录用完日期").font(.caption).foregroundStyle(.secondary)
              }
            }
            Spacer()
            if let days = record.usageDays {
              Text("使用 \(days) 天").font(.subheadline).foregroundStyle(.secondary)
            }
          }
        }
      }
      .padding(14)
      .appSurface()
    }
  }
}
