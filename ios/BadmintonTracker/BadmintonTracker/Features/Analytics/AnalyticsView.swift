import Charts
import SwiftUI
import UIKit

struct AnalyticsView: View {
  @Environment(AppSession.self) private var session
  @State private var showingPurchase = false
  @State private var availableWidth: CGFloat = 0
  @Environment(\.dynamicTypeSize) private var typeSize
  @State private var isAnnual = false
  @State private var selectedYear = Calendar.current.component(.year, from: Date())
  private var selectedRange: String { isAnnual ? String(selectedYear) : "all" }
  @State private var selectedFilter: AnalyticsPurchaseFilter?

  private func makeChannelSummaries(from entries: [SpendingEntry]) -> [ChannelSummary] {
    Dictionary(grouping: entries, by: \.channel).map { channel, records in
      ChannelSummary(channel: channel, amount: records.reduce(0) { $0 + ($1.amount ?? 0) }, count: records.count)
    }.sorted { $0.amount == $1.amount ? $0.channel < $1.channel : $0.amount > $1.amount }
  }

  var body: some View {
    let analytics = session.analytics(for: selectedRange)
    let currentYear = Calendar.current.component(.year, from: Date())
    let years = Array(min(analytics.availableYears.min() ?? currentYear, currentYear)...max(analytics.availableYears.max() ?? currentYear, currentYear))
    let rangeLabel = selectedRange == "all" ? AppLanguage.text("全部历史") : selectedRange
    let expenseEntries = session.spendingEntries.filter { $0.isInRange(selectedRange) }
    let channelSummaries = makeChannelSummaries(from: expenseEntries)
    let stringingEntries = expenseEntries.filter { $0.stringing != nil }
    let hasChartData = !analytics.trend.isEmpty ||
      !analytics.brandShare.isEmpty ||
      !analytics.categoryShare.isEmpty ||
      !analytics.frequency.isEmpty ||
      !channelSummaries.isEmpty

    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        AnalyticsPeriodPicker(isAnnual: $isAnnual, selectedYear: $selectedYear, years: years)
          .padding(.horizontal)

        if let message = session.errorMessage {
          ErrorBanner(message: message)
        }

        if !hasChartData {
          EmptyStateView(title: "暂无分析数据", message: "有购买记录后，这里会生成趋势、占比和频率图表。", systemImage: "chart.bar", actionTitle: "记录购买", action: { showingPurchase = true })
            .padding(.horizontal)
        } else {
          AnalyticsSummary(entries: session.spendingEntries)
            .padding(.horizontal)
          LazyVGrid(columns: availableWidth > 850 && !typeSize.isAccessibilitySize ? [GridItem(.flexible(), alignment: .top), GridItem(.flexible(), alignment: .top)] : [GridItem(.flexible())], alignment: .leading, spacing: 16) {
          TrendChartCard(data: analytics.trend, rangeLabel: rangeLabel) { value in
            selectedFilter = AnalyticsPurchaseFilter(range: selectedRange, dimension: .period(value))
          }
            .padding(.horizontal)

          DonutChartCard(data: analytics.brandShare, rangeLabel: rangeLabel) { value in
            selectedFilter = AnalyticsPurchaseFilter(range: selectedRange, dimension: .brand(value))
          }
            .padding(.horizontal)

          CategoryBarChartCard(data: analytics.categoryShare, rangeLabel: rangeLabel) { value in
            selectedFilter = AnalyticsPurchaseFilter(range: selectedRange, dimension: .category(value))
          }
            .padding(.horizontal)

          ChannelChartCard(data: channelSummaries, rangeLabel: rangeLabel) { value in
            selectedFilter = AnalyticsPurchaseFilter(range: selectedRange, dimension: .channel(value))
          }
            .padding(.horizontal)

          FrequencyChartCard(data: analytics.frequency, rangeLabel: rangeLabel) { value in
            selectedFilter = AnalyticsPurchaseFilter(range: selectedRange, dimension: .purchasePeriod(value))
          }
            .padding(.horizontal)
          StringingAnalysisCard(entries: stringingEntries) { model in
            selectedFilter = AnalyticsPurchaseFilter(range: selectedRange, dimension: .stringModel(model))
          }
          .padding(.horizontal)
          if expenseEntries.contains(where: { $0.stringing != nil && $0.date == nil }) {
            Text("未填写日期的穿线费用已计入总支出，暂不计入时间趋势。")
              .font(.caption).foregroundStyle(.secondary).padding(.horizontal)
          }
          }
        }
      }
      .padding(.bottom, 24)
      .padding(.top, 12)
    }
    .background(Color(.systemGroupedBackground))
    .background(GeometryReader { proxy in
      Color.clear
        .onChange(of: proxy.size.width, initial: true) { _, width in availableWidth = width }
    })
    .sheet(item: $selectedFilter) { filter in
      NavigationStack {
        AnalyticsPurchaseList(filter: filter)
          .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { selectedFilter = nil } } }
      }
    }
    .sheet(isPresented: $showingPurchase) { AddPurchaseView() }
    .navigationTitle("分析")
    .navigationBarTitleDisplayMode(.inline)
  }
}

private struct AnalyticsPeriodPicker: View {
  @Binding var isAnnual: Bool
  @Binding var selectedYear: Int
  let years: [Int]

  var body: some View {
    VStack(spacing: 12) {
      Picker("统计范围", selection: $isAnnual) {
        Text("全部").tag(false)
        Text("年度").tag(true)
      }
      .pickerStyle(.segmented)

      if isAnnual {
        HStack {
          Button { selectedYear -= 1 } label: {
            Image(systemName: "chevron.left").frame(width: 44, height: 44)
          }
          .disabled(selectedYear <= (years.first ?? selectedYear))
          .accessibilityLabel("上一年")
          Spacer()
          Picker("年份", selection: $selectedYear) {
            ForEach(years.reversed(), id: \.self) { year in
              Text(String(year)).tag(year)
            }
          }
          .pickerStyle(.menu)
          .font(.headline.monospacedDigit())
          Spacer()
          Button { selectedYear += 1 } label: {
            Image(systemName: "chevron.right").frame(width: 44, height: 44)
          }
          .disabled(selectedYear >= (years.last ?? selectedYear))
          .accessibilityLabel("下一年")
        }
      }
    }
  }
}

private struct AnalyticsChartCard<Content: View>: View {
  let title: String
  let subtitle: String
  @ViewBuilder var content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      VStack(alignment: .leading, spacing: 3) {
        Text(LocalizedStringKey(title))
          .font(.headline)
        Text(LocalizedStringKey(subtitle))
          .font(.caption.weight(.medium))
          .foregroundStyle(.secondary)
      }

      content
    }
    .padding(16)
    .appSurface()
  }
}

private struct TrendChartCard: View {
  @Environment(\.appAccentColor) private var accent
  let data: [TrendPoint]
  let rangeLabel: String
  let onSelect: (String) -> Void

  private var chartData: [TrendChartPoint] {
    data.enumerated().map { index, point in
      TrendChartPoint(bucket: point.bucket, label: displayAxisLabel(point.bucket), amount: point.amount)
    }
  }

  private var chartTitle: String {
    data.first?.bucket.count == 4 ? "年度投入趋势" : "月度投入趋势"
  }

  private var yScale: AnalyticsYAxisScale {
    AnalyticsYAxisScale.make(maxValue: chartData.map(\.amount).max() ?? 0)
  }

  var body: some View {
    AnalyticsChartCard(title: chartTitle, subtitle: rangeLabel + " · " + AppLanguage.text("含穿线费用")) {
      if chartData.isEmpty {
        ChartEmptyMessage()
      } else {
        Chart(chartData) { item in
          AreaMark(
            x: .value("时间", item.bucket),
            y: .value("投入", item.amount)
          )
          .interpolationMethod(.linear)
          .foregroundStyle(accent.opacity(0.14))
          .accessibilityHidden(true)

          LineMark(
            x: .value("时间", item.bucket),
            y: .value("投入", item.amount)
          )
          .interpolationMethod(.linear)
          .foregroundStyle(accent)
          .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
          .accessibilityHidden(true)

          PointMark(
            x: .value("时间", item.bucket),
            y: .value("投入", item.amount)
          )
          .foregroundStyle(accent)
          .symbolSize(30)
          .accessibilityLabel(item.bucket)
          .accessibilityValue(exactChartMoney(item.amount))
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(AnalyticsChartInspection(values: chartData.map { ChartInspectionDatum(key: $0.bucket, title: $0.bucket, value: exactChartMoney($0.amount)) }, onSelect: onSelect))
        .chartXScale(domain: chartData.map(\.bucket))
        .chartYScale(domain: yScale.domain)
        .chartXAxis {
          AxisMarks(values: chartData.map(\.bucket)) { value in
            AxisGridLine()
              .foregroundStyle(.clear)
            AxisValueLabel {
              if let bucket = value.as(String.self),
                 let item = chartData.first(where: { $0.bucket == bucket }) {
                Text(LocalizedStringKey(item.label))
                  .font(.caption2)
                  .lineLimit(1)
              }
            }
          }
        }
        .chartYAxis {
          AxisMarks(position: .leading, values: yScale.marks) { value in
            AxisGridLine()
            AxisValueLabel {
              if let amount = value.as(Double.self) {
                Text(compactMoney(amount))
              }
            }
          }
        }
        .frame(height: 230)
        Menu("查看支出明细", systemImage: "list.bullet") {
          ForEach(chartData) { point in
            Button("\(point.bucket) · \(exactChartMoney(point.amount))") { onSelect(point.bucket) }
          }
        }
        .font(.subheadline)

      }
    }
  }
}

private struct DonutChartCard: View {
  let data: [BrandShare]
  let rangeLabel: String
  let onSelect: (String) -> Void

  private var topData: [BrandShare] {
    Array(data.prefix(8))
  }

  private var total: Double {
    topData.reduce(0) { $0 + $1.amount }
  }

  var body: some View {
    AnalyticsChartCard(title: "品牌投入占比", subtitle: rangeLabel + " · " + AppLanguage.text("按装备品牌，含穿线费用")) {
      if topData.isEmpty {
        ChartEmptyMessage()
      } else {
        ZStack {
          Chart(topData, id: \.brand) { item in
            SectorMark(
              angle: .value("投入", item.amount),
              innerRadius: .ratio(0.6),
              angularInset: 1.6
            )
            .cornerRadius(4)
            .foregroundStyle(by: .value("品牌", item.brand))
          }
          .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(AnalyticsChartInspection(
            values: topData.map { ChartInspectionDatum(key: $0.brand, title: $0.brand, value: exactChartMoney($0.amount)) },
            sectorAmounts: topData.map(\.amount),
            onSelect: onSelect
          ))
          .chartLegend(.hidden)
          .chartForegroundStyleScale(domain: topData.map(\.brand), range: topData.enumerated().map { ChartPalette.brandColor($0.element.brand, fallbackIndex: $0.offset) })

          VStack(spacing: 3) {
            Text(data.count > 8 ? "前八品牌小计" : "合计")
              .font(.caption)
              .foregroundStyle(.secondary)
            Text(compactMoney(total))
              .font(.headline.weight(.semibold))
              .minimumScaleFactor(0.75)
          }
          .allowsHitTesting(false)
        }
        .frame(height: 230)

        ChartLegend(items: topData.enumerated().map {
          ChartLegendItem(color: ChartPalette.brandColor($0.element.brand, fallbackIndex: $0.offset), title: $0.element.brand, value: money($0.element.amount))
        }, onSelect: onSelect)
      }
    }
  }
}

private struct CategoryBarChartCard: View {
  let data: [CategoryShare]
  let rangeLabel: String
  let onSelect: (String) -> Void

  var body: some View {
    AnalyticsChartCard(title: "品类投入对比", subtitle: rangeLabel) {
      if data.isEmpty {
        ChartEmptyMessage()
      } else {
        Chart(Array(data.enumerated()), id: \.element.category) { index, item in
          BarMark(
            x: .value("品类", item.category),
            y: .value("投入", item.amount),
            width: .fixed(data.count > 4 ? 24 : 34)
          )
          .foregroundStyle(ChartPalette.color(at: index))
          .cornerRadius(7)
          .accessibilityLabel(Text(LocalizedStringKey(item.category)))
          .accessibilityValue(exactChartMoney(item.amount))
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(AnalyticsChartInspection(values: data.map { ChartInspectionDatum(key: $0.category, title: $0.category, value: exactChartMoney($0.amount)) }, onSelect: onSelect))
        .chartXScale(range: .plotDimension(padding: 18))
        .chartYAxis {
          AxisMarks(position: .leading) { value in
            AxisGridLine()
            AxisValueLabel {
              if let amount = value.as(Double.self) {
                Text(compactMoney(amount))
              }
            }
          }
        }
        .chartXAxis {
          AxisMarks { value in
            AxisValueLabel {
              if let label = value.as(String.self) {
                Text(LocalizedStringKey(label))
                  .font(.caption2)
                  .lineLimit(1)
                  .minimumScaleFactor(0.75)
              }
            }
          }
        }
        .frame(height: 230)
        Menu("查看支出明细", systemImage: "list.bullet") {
          ForEach(data, id: \.category) { point in
            Button("\(AppLanguage.text(point.category)) · \(exactChartMoney(point.amount))") { onSelect(point.category) }
          }
        }
        .font(.subheadline)

      }
    }
  }
}

private struct ChannelChartCard: View {
  let data: [ChannelSummary]
  let rangeLabel: String
  let onSelect: (String) -> Void

  private var topData: [ChannelSummary] {
    Array(data.prefix(8))
  }

  private var yScale: AnalyticsYAxisScale {
    AnalyticsYAxisScale.make(maxValue: topData.map(\.amount).max() ?? 0)
  }

  var body: some View {
    AnalyticsChartCard(title: "支出渠道", subtitle: rangeLabel) {
      if topData.isEmpty {
        ChartEmptyMessage()
      } else {
        Chart(Array(topData.enumerated()), id: \.element.channel) { index, item in
          BarMark(
            x: .value("渠道", item.channel),
            y: .value("投入", item.amount),
            width: .fixed(topData.count > 4 ? 24 : 34)
          )
          .foregroundStyle(ChartPalette.color(at: index))
          .cornerRadius(7)
          .accessibilityLabel(Text(LocalizedStringKey(item.channel)))
          .accessibilityValue(exactChartMoney(item.amount))
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(AnalyticsChartInspection(values: topData.map { ChartInspectionDatum(key: $0.channel, title: $0.channel, value: "\(exactChartMoney($0.amount)) · \($0.count) 次") }, onSelect: onSelect))
        .chartXScale(range: .plotDimension(padding: 18))
        .chartYScale(domain: yScale.domain)
        .chartYAxis {
          AxisMarks(position: .leading, values: yScale.marks) { value in
            AxisGridLine()
            AxisValueLabel {
              if let amount = value.as(Double.self) {
                Text(compactMoney(amount))
              }
            }
          }
        }
        .chartXAxis {
          AxisMarks { value in
            AxisValueLabel {
              if let label = value.as(String.self) {
                Text(LocalizedStringKey(label))
                  .font(.caption2)
                  .lineLimit(1)
                  .minimumScaleFactor(0.75)
              }
            }
          }
        }
        .frame(height: 220)

        ChartLegend(items: topData.enumerated().map {
          ChartLegendItem(
            color: ChartPalette.color(at: $0.offset),
            title: $0.element.channel,
            value: String(localized: "\($0.element.count) 次 / \(money($0.element.amount))", bundle: AppLanguage.bundle, locale: AppLanguage.locale)
          )
        }, onSelect: onSelect)
      }
    }
  }
}

private struct FrequencyChartCard: View {
  let data: [FrequencyPoint]
  let rangeLabel: String
  let onSelect: (String) -> Void

  private var chartData: [FrequencyChartPoint] {
    data.enumerated().map { index, point in
      FrequencyChartPoint(bucket: point.bucket, label: displayAxisLabel(point.bucket), count: point.count)
    }
  }

  private var chartTitle: String {
    data.first?.bucket.count == 4 ? "购买频率（年）" : "购买频率（月）"
  }

  private var yScale: AnalyticsYAxisScale {
    AnalyticsYAxisScale.make(
      maxValue: Double(chartData.map(\.count).max() ?? 0),
      desiredTickCount: 4,
      forceIntegerSteps: true
    )
  }

  var body: some View {
    AnalyticsChartCard(title: chartTitle, subtitle: rangeLabel) {
      if chartData.isEmpty {
        ChartEmptyMessage()
      } else {
        Chart(chartData) { item in
          BarMark(
            x: .value("时间", item.bucket),
            y: .value("次数", Double(item.count)),
            width: .fixed(chartData.count > 8 ? 14 : 24)
          )
          .foregroundStyle(.purple)
          .cornerRadius(7)
          .accessibilityLabel(item.bucket)
          .accessibilityValue("\(item.count) 次")
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(AnalyticsChartInspection(values: chartData.map { ChartInspectionDatum(key: $0.bucket, title: $0.bucket, value: "\($0.count) 次") }, onSelect: onSelect))
        .chartXScale(domain: chartData.map(\.bucket))
        .chartYScale(domain: yScale.domain)
        .chartYAxis {
          AxisMarks(position: .leading, values: yScale.marks) { value in
            AxisGridLine()
            AxisValueLabel {
              if let count = value.as(Double.self) {
                Text(count.formatted(.number.precision(.fractionLength(0))))
              }
            }
          }
        }
        .chartXAxis {
          AxisMarks(values: chartData.map(\.bucket)) { value in
            AxisGridLine()
              .foregroundStyle(.clear)
            AxisValueLabel {
              if let bucket = value.as(String.self),
                 let item = chartData.first(where: { $0.bucket == bucket }) {
                Text(LocalizedStringKey(item.label))
                  .font(.caption2)
                  .lineLimit(1)
              }
            }
          }
        }
        .frame(height: 210)
        Menu("查看购买记录", systemImage: "list.bullet") {
          ForEach(chartData) { point in
            Button("\(point.bucket) · \(point.count) 次") { onSelect(point.bucket) }
          }
        }
        .font(.subheadline)

      }
    }
  }
}

private struct TrendChartPoint: Identifiable {
  let bucket: String
  let label: String
  let amount: Double

  var id: String { bucket }
}

private struct FrequencyChartPoint: Identifiable {
  let bucket: String
  let label: String
  let count: Int

  var id: String { bucket }
}

private struct ChannelSummary: Identifiable, Hashable {
  let channel: String
  let amount: Double
  let count: Int

  var id: String { channel }
}

private struct ChartLegendItem: Identifiable {
  var id: String { title }
  let color: Color
  let title: String
  let value: String
}

private struct ChartLegend: View {
  let items: [ChartLegendItem]
  let onSelect: (String) -> Void

  var body: some View {
    LazyVGrid(columns: [GridItem(.adaptive(minimum: 180))], alignment: .leading, spacing: 10) {
      ForEach(items) { item in
        Button { onSelect(item.title) } label: {
          HStack(spacing: 8) {
            Circle().fill(item.color).frame(width: 9, height: 9)
            VStack(alignment: .leading, spacing: 1) {
              Text(LocalizedStringKey(item.title)).font(.caption.weight(.medium)).fixedSize(horizontal: false, vertical: true)
              Text(item.value).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption2).foregroundStyle(.tertiary)
          }
          .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("查看支出明细")
      }
    }
  }
}

private struct ChartEmptyMessage: View {
  var text = "暂无图表数据"

  var body: some View {
    Text(LocalizedStringKey(text))
      .font(.subheadline)
      .foregroundStyle(.secondary)
      .frame(maxWidth: .infinity, minHeight: 160)
  }
}

private enum ChartPalette {
  static func brandColor(_ brand: String, fallbackIndex: Int) -> Color {
    switch LocalBrandNormalizer.canonicalName(brand) {
    case "李宁": return .red
    case "VICTOR": return .blue
    case "YONEX": return .green
    default:
      let remaining: [Color] = [.orange, .purple, .cyan, .pink, .indigo, .mint, .brown, .gray]
      return remaining[fallbackIndex % remaining.count]
    }
  }

  static let colors: [Color] = [
    .blue,
    .green,
    .orange,
    .purple,
    .pink,
    .cyan,
    .indigo,
    .mint
  ]

  static func color(at index: Int) -> Color {
    colors[index % colors.count]
  }
}

private func displayAxisLabel(_ bucket: String) -> String {
  if bucket.count == 4 {
    return bucket
  }
  if bucket.count >= 7 {
    let monthStart = bucket.index(bucket.startIndex, offsetBy: 5)
    let monthEnd = bucket.index(monthStart, offsetBy: 2)
    let month = String(bucket[monthStart..<monthEnd]).trimmingCharacters(in: CharacterSet(charactersIn: "0"))
    if !month.isEmpty {
      return "\(month)月"
    }
  }
  return bucket
}

private func compactMoney(_ value: Double) -> String {
  if value >= 10_000 {
    return "¥" + (value / 10_000).formatted(.number.precision(.fractionLength(0...1))) + "万"
  }
  return "¥" + value.formatted(.number.precision(.fractionLength(0)))
}

private func parseAnalyticsDate(_ rawValue: String?) -> Date? {
  guard let rawValue else { return nil }
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  if let date = formatter.date(from: rawValue) {
    return date
  }
  formatter.formatOptions = [.withInternetDateTime]
  return formatter.date(from: rawValue)
}

private struct ChartInspectionDatum {
  let key: String
  let title: String
  let value: String
}

private func exactChartMoney(_ amount: Double) -> String {
  amount.formatted(.currency(code: "CNY").precision(.fractionLength(2)))
}

/// Tap opens matching records; hold and scrub inspects values without navigating.
private struct AnalyticsChartInspection: ViewModifier {
  let values: [ChartInspectionDatum]
  var sectorAmounts: [Double]? = nil
  let onSelect: (String) -> Void
  @State private var inspectionLocation: CGPoint?
  @Environment(\.appReduceTransparency) private var reduceTransparency

  private func datum(at location: CGPoint, proxy: ChartProxy, frame: CGRect) -> ChartInspectionDatum? {
    guard frame.contains(location) else { return nil }
    if let amounts = sectorAmounts {
      let dx = location.x - frame.midX, dy = location.y - frame.midY
      let radius = min(frame.width, frame.height) / 2
      let distance = hypot(dx, dy)
      guard distance >= radius * 0.6, distance <= radius else { return nil }
      var angle = atan2(dx, -dy)
      if angle < 0 { angle += 2 * .pi }
      guard let value = proxy.value(atAngle: .radians(Double(angle)), as: Double.self),
            let index = AnalyticsPurchaseFilter.sectorIndex(value: value, amounts: amounts),
            values.indices.contains(index) else { return nil }
      return values[index]
    }
    guard let key = proxy.value(atX: location.x - frame.minX, as: String.self) else { return nil }
    return values.first { $0.key == key }
  }

  func body(content: Content) -> some View {
    content.chartOverlay { proxy in
      GeometryReader { geometry in
        if let anchor = proxy.plotFrame {
          let frame = geometry[anchor]
          let selected = inspectionLocation.flatMap { datum(at: $0, proxy: proxy, frame: frame) }
          ZStack(alignment: .topLeading) {
            ChartTouchSurface(onTap: { location in
              if let selected = datum(at: location, proxy: proxy, frame: frame) { onSelect(selected.key) }
            }, onInspect: { inspectionLocation = $0 })
              .accessibilityHidden(true)

            if let selected {
              if sectorAmounts == nil, let x = proxy.position(forX: selected.key) {
                Path { path in
                  path.move(to: CGPoint(x: frame.minX + x, y: frame.minY))
                  path.addLine(to: CGPoint(x: frame.minX + x, y: frame.maxY))
                }
                .stroke(.secondary.opacity(0.65), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                .allowsHitTesting(false)
              }
              VStack(alignment: .leading, spacing: 3) {
                Text(selected.title).font(.caption).foregroundStyle(.secondary)
                Text(selected.value).font(.subheadline.weight(.semibold)).monospacedDigit()
              }
              .padding(.horizontal, 12)
              .padding(.vertical, 8)
              .frame(maxWidth: max(0, frame.width - 12), alignment: .leading)
              .background(reduceTransparency ? AnyShapeStyle(Color(.secondarySystemBackground)) : AnyShapeStyle(.regularMaterial), in: RoundedRectangle(cornerRadius: 10))
              .padding(.leading, frame.minX + 6)
              .padding(.top, frame.minY + 6)
              .allowsHitTesting(false)
            }
          }
        }
      }
    }
  }
}

/// No drag recognizer: the enclosing scroll view owns all swipes.
private struct ChartTouchSurface: UIViewRepresentable {
  let onTap: (CGPoint) -> Void
  let onInspect: (CGPoint?) -> Void

  func makeCoordinator() -> Coordinator { Coordinator(onTap: onTap, onInspect: onInspect) }

  func makeUIView(context: Context) -> UIView {
    let view = UIView()
    view.backgroundColor = .clear
    let press = UILongPressGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.inspect(_:)))
    press.minimumPressDuration = 0.3
    press.allowableMovement = 10
    press.cancelsTouchesInView = false
    press.delegate = context.coordinator
    let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tap(_:)))
    tap.cancelsTouchesInView = false
    tap.require(toFail: press)
    tap.delegate = context.coordinator
    view.addGestureRecognizer(press)
    view.addGestureRecognizer(tap)
    return view
  }

  func updateUIView(_ view: UIView, context: Context) {
    context.coordinator.onTap = onTap
    context.coordinator.onInspect = onInspect
  }

  final class Coordinator: NSObject, UIGestureRecognizerDelegate {
    var onTap: (CGPoint) -> Void
    var onInspect: (CGPoint?) -> Void
    init(onTap: @escaping (CGPoint) -> Void, onInspect: @escaping (CGPoint?) -> Void) {
      self.onTap = onTap
      self.onInspect = onInspect
    }
    private func isScrolling(_ view: UIView?) -> Bool {
      var ancestor = view?.superview
      while let current = ancestor {
        if let scroll = current as? UIScrollView,
           scroll.panGestureRecognizer.state == .began || scroll.panGestureRecognizer.state == .changed { return true }
        ancestor = current.superview
      }
      return false
    }
    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
      !isScrolling(gestureRecognizer.view)
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
      shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
      otherGestureRecognizer is UIPanGestureRecognizer
    }
    @objc func tap(_ gesture: UITapGestureRecognizer) {
      guard gesture.state == .ended, !isScrolling(gesture.view) else { return }
      onTap(gesture.location(in: gesture.view))
    }
    @objc func inspect(_ gesture: UILongPressGestureRecognizer) {
      if (gesture.state == .began || gesture.state == .changed), !isScrolling(gesture.view) {
        onInspect(gesture.location(in: gesture.view))
      } else {
        onInspect(nil)
      }
    }
  }
}

struct AnalyticsPurchaseList: View {
  @Environment(AppSession.self) private var session
  let filter: AnalyticsPurchaseFilter?

  var body: some View {
    let records = session.spendingEntries.filter { entry in
      guard let filter else { return true }
      return entry.isInRange(filter.range) && entry.matches(filter.dimension)
    }
    List {
      Section {
        LabeledContent("购买记录", value: "\(records.filter { $0.purchase != nil }.count) 笔")
        LabeledContent("穿线记录", value: "\(records.filter { $0.stringing != nil }.count) 次")
        LabeledContent("总支出", value: money(records.reduce(0) { $0 + ($1.amount ?? 0) }))
      } header: {
        Text(filter == nil || filter?.range == "all" ? "全部历史" : "\(filter!.range) 年")
      }
      Section("支出明细") {
        if records.isEmpty {
          ContentUnavailableView("暂无记录", systemImage: "bag")
        }
        ForEach(records) { entry in
          NavigationLink {
            if let purchase = entry.purchase { AnalyticsPurchaseDetail(purchaseID: purchase.id) }
            else { StringingExpenseDetail(entryID: entry.id) }
          } label: {
            HStack(alignment: .top, spacing: 12) {
              if let purchase = entry.purchase {
                RemoteImageView(url: GearImageResolver.preferredImageURL(imageKey: purchase.gearItem?.imageKey,
                  coverImageUrl: purchase.gearItem?.coverImageUrl), systemImage: "sportscourt",
                  imageKey: purchase.gearItem?.imageKey, coverImageUrl: purchase.gearItem?.coverImageUrl,
                  categoryName: purchase.category?.name).frame(width: 48, height: 48)
              } else {
                Image(systemName: "tennis.racket").font(.title2).foregroundStyle(.purple).frame(width: 48, height: 48)
              }
              VStack(alignment: .leading, spacing: 5) {
                Text(entry.title).font(.headline)
                if let gear = entry.gearName { Text("\(gear) · 穿线").font(.caption).foregroundStyle(.secondary) }
                Text(entry.date.map(shortDate) ?? "未记录日期").font(.caption).foregroundStyle(.secondary)
                Text(entry.amount.map { money($0) } ?? "费用未记录").font(.subheadline.weight(.semibold))
              }
            }.padding(.vertical, 4)
          }
        }
      }
    }
    .navigationTitle(filter?.dimension.title ?? "累计投入")
    .navigationBarTitleDisplayMode(.inline)
  }
}

private struct StringingExpenseDetail: View {
  @Environment(AppSession.self) private var session
  let entryID: String
  var body: some View {
    List {
      if let entry = session.spendingEntries.first(where: { $0.id == entryID }), let record = entry.stringing {
        Section {
          LabeledContent("装备", value: entry.gearName ?? "未记录")
          LabeledContent("球线型号", value: entry.stringModel ?? "未记录")
          LabeledContent("穿线日期", value: entry.date.map(shortDate) ?? "未记录")
          LabeledContent("费用", value: entry.amount.map { money($0) } ?? "未记录")
          LabeledContent("渠道", value: entry.channel)
          if let main = record.mainTension { LabeledContent("竖线磅数", value: main.formatted()) }
          if let cross = record.crossTension { LabeledContent("横线磅数", value: cross.formatted()) }
          if let notes = record.notes, !notes.isEmpty { Text(notes) }
        }
      } else { ContentUnavailableView("记录已不存在", systemImage: "tennis.racket") }
    }.navigationTitle("穿线详情").navigationBarTitleDisplayMode(.inline)
  }
}

private struct StringingAnalysisCard: View {
  @Environment(AppSession.self) private var session

  // Use the full history so changing the displayed year never reassigns colors.
  private var modelColors: [String: Color] {
    let names = Set(session.spendingEntries.filter { $0.stringing != nil }
      .map { $0.stringModel ?? "未记录型号" }).sorted()
    return Dictionary(uniqueKeysWithValues: names.enumerated().map { index, name in
      let color = index < ChartPalette.colors.count
        ? ChartPalette.color(at: index)
        : Color(hue: (Double(index) * 0.61803398875).truncatingRemainder(dividingBy: 1), saturation: 0.58, brightness: 0.78)
      return (name, color)
    })
  }
  let entries: [SpendingEntry]
  let onSelect: (String) -> Void
  var body: some View {
    let colors = modelColors
    let groups = Dictionary(grouping: entries, by: { $0.stringModel ?? "未记录型号" })
    let models = groups.keys.sorted {
      let left = groups[$0]?.count ?? 0, right = groups[$1]?.count ?? 0
      return left == right ? $0 < $1 : left > right
    }
    if !entries.isEmpty {
      AnalyticsChartCard(title: "球线使用与费用", subtitle: "\(entries.count) 次穿线 · \(money(entries.reduce(0) { $0 + ($1.amount ?? 0) }))") {
        Chart(models, id: \.self) { model in
          BarMark(x: .value("型号", model), y: .value("次数", groups[model]?.count ?? 0))
            .foregroundStyle(colors[model] ?? .secondary).cornerRadius(4)
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(AnalyticsChartInspection(values: models.map { model in
          let rows = groups[model] ?? []
          return ChartInspectionDatum(key: model, title: model,
            value: "\(rows.count) 次 · \(exactChartMoney(rows.reduce(0) { $0 + ($1.amount ?? 0) }))")
        }, onSelect: onSelect))
        .frame(height: 200)
        ForEach(models, id: \.self) { model in
          let rows = groups[model] ?? []
          Button { onSelect(model) } label: {
            HStack {
              Circle().fill(colors[model] ?? .secondary)
                .frame(width: 9, height: 9)
              Text(model)
              Spacer()
              Text("\(rows.count) 次 · \(money(rows.reduce(0) { $0 + ($1.amount ?? 0) }))").foregroundStyle(.secondary)
              Image(systemName: "chevron.right").font(.caption)
            }.font(.subheadline).frame(minHeight: 44)
          }.buttonStyle(.plain)
        }
        if entries.contains(where: { $0.amount == nil }) {
          Text("未填写费用的记录只计入穿线次数。").font(.caption).foregroundStyle(.secondary)
        }
      }
    }
  }
}

struct AnalyticsPurchaseDetail: View {
  @Environment(AppSession.self) private var session
  @State private var isDeleting = false
  let purchaseID: String

  var body: some View {
    Group {
      if let purchase = session.purchases.first(where: { $0.id == purchaseID }) {
        List {
          Section {
            Text(purchase.displayName).font(.headline)
            LabeledContent("品牌", value: purchase.analyticsBrandName)
            LabeledContent("分类", value: purchase.analyticsCategoryName)
          }
          Section("购买信息") {
            LabeledContent("购买日期", value: shortDate(purchase.purchaseDate))
            LabeledContent("购买来源", value: purchase.normalizedChannelName)
            LabeledContent("数量", value: "\(purchase.quantity)")
            if let price = purchase.effectiveUnitPriceCny {
              LabeledContent("单价", value: money(price))
            }
            LabeledContent("总金额", value: money(purchase.totalPriceCny))
            LabeledContent("状态", value: purchase.inventoryStatusText)
          }
          if let notes = purchase.notes, !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            Section("备注") { Text(notes) }
          }
          Section {
            PurchaseDeleteButton(purchase: purchase, isDeleting: $isDeleting)
          }
        }
      } else {
        ContentUnavailableView("记录已不存在", systemImage: "bag")
      }
    }
    .navigationTitle("购买详情")
    .navigationBarTitleDisplayMode(.inline)
    .disabled(isDeleting)
    .navigationBarBackButtonHidden(isDeleting)
  }
}

private struct AnalyticsSummary: View {
  let entries: [SpendingEntry]
  private var thisMonth: [SpendingEntry] {
    entries.filter { AppDate.parseISODate($0.date).map { Calendar.current.isDate($0, equalTo: Date(), toGranularity: .month) } ?? false }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("本月花费").font(.subheadline).foregroundStyle(.secondary)
      Text(money(thisMonth.reduce(0) { $0 + ($1.amount ?? 0) }))
        .font(.title.bold()).monospacedDigit()
      Text("购买 \(thisMonth.filter { $0.purchase != nil }.count) 笔 · 穿线 \(thisMonth.filter { $0.stringing != nil }.count) 次")
        .font(.caption).foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .appSurface()
    .accessibilityElement(children: .combine)
  }
}
