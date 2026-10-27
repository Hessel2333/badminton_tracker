import SwiftUI

struct PurchaseSuccess {
  enum Kind {
    case firstGear, newGear, repeatPurchase, wishlist
  }

  let purchase: PurchaseInput
  let kind: Kind

  var title: String {
    switch kind {
    case .firstGear: "第一件装备，\n新的开始。"
    case .newGear: "新装备，\n新期待。"
    case .repeatPurchase: "再次入手，\n热爱继续。"
    case .wishlist: "心愿实现，\n快乐加倍。"
    }
  }

  var message: String {
    switch kind {
    case .firstGear: "从这里开始，留下你的羽球足迹。"
    case .newGear: "装备已加入清单，期待下一次上场。"
    case .repeatPurchase: "这次购买已记下，热爱继续。"
    case .wishlist: "从想要到拥有，值得开心一下。"
    }
  }

  var name: String {
    GearDisplayName.resolve(name: purchase.itemNameSnapshot, brand: purchase.brandName,
      model: purchase.modelCode, category: purchase.categoryName, imageKey: purchase.gearImageKey)
  }

  var imageKey: String? {
    purchase.gearCoverImageUrl == nil ? purchase.gearImageKey : nil
  }
}

struct PurchaseSuccessView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.appNavigation) private var navigation
  @Environment(\.appReduceMotion) private var reduceMotion
  @Environment(\.dynamicTypeSize) private var typeSize
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.appAccentColor) private var accent
  @ScaledMetric(relativeTo: .largeTitle) private var headlineSize = 36
  @AccessibilityFocusState private var titleFocused: Bool
  @State private var appeared = false
  @State private var burstProgress: CGFloat = 0

  let success: PurchaseSuccess

  private var background: Color {
    Color(.systemGroupedBackground)
  }

  var body: some View {
    GeometryReader { geometry in
      ScrollView {
        VStack(spacing: 18) {
          introduction
            .opacity(appeared || reduceMotion ? 1 : 0)
            .offset(y: appeared || reduceMotion ? 0 : 8)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.26), value: appeared)

          PurchaseSuccessArtwork(success: success, accent: accent, appeared: appeared,
            burstProgress: burstProgress)
            .frame(height: typeSize.isAccessibilitySize ? 164 : min(280, max(180, geometry.size.height * 0.37)))

          gearIdentity

          receipt
            .opacity(appeared || reduceMotion ? 1 : 0)
            .offset(y: appeared || reduceMotion ? 0 : 8)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.24).delay(0.12), value: appeared)
        }
        .padding(.vertical, 24)
        .frame(maxWidth: 440)
        .frame(maxWidth: .infinity, minHeight: geometry.size.height)
        .padding(.horizontal, 24)
      }
      .scrollBounceBehavior(.basedOnSize)
    }
    .background(background)
    .safeAreaInset(edge: .bottom) {
      VStack(spacing: 4) {
        Button {
          dismiss()
          navigation?.showGear(id: LocalGearIdentity.id(name: success.purchase.itemNameSnapshot,
            brandName: success.purchase.brandName, modelCode: success.purchase.modelCode,
            categoryName: success.purchase.categoryName))
        } label: {
          HStack {
            Spacer(minLength: 0)
            Text("查看装备")
            Spacer(minLength: 0)
            Image(systemName: "arrow.right")
              .accessibilityHidden(true)
          }
        }
          .buttonStyle(PurchaseSuccessButtonStyle(fill: accent, foreground: colorScheme == .dark ? .black : .white))
          .frame(maxWidth: 440)
          .frame(maxWidth: .infinity)
          .accessibilityIdentifier("purchaseSuccess.viewGear")
        Button("完成") { dismiss() }
          .frame(minHeight: 44)
          .accessibilityIdentifier("purchaseSuccess.done")
      }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 16)
        .background(background)
    }
    .toolbar(.hidden, for: .navigationBar)
    .task {
      guard !appeared else { return }
      appeared = true
      if !reduceMotion {
        withAnimation(.easeOut(duration: 1.1)) { burstProgress = 1 }
      }
      titleFocused = true
    }
  }

  private var introduction: some View {
    VStack(spacing: 14) {
      Label("入手成功", systemImage: "checkmark.circle.fill")
        .font(.subheadline.weight(.medium))
        .foregroundStyle(accent)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(accent.opacity(0.08), in: Capsule())

      Text(LocalizedStringKey(success.title))
        .font(.system(size: headlineSize, weight: .bold, design: .rounded))
        .tracking(-0.8)
        .lineSpacing(3)
        .accessibilityAddTraits(.isHeader)
        .accessibilityFocused($titleFocused)
        .accessibilityIdentifier("purchaseSuccess.title")

      Text(LocalizedStringKey(success.message))
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
    .multilineTextAlignment(.center)
    .fixedSize(horizontal: false, vertical: true)
  }

  private var gearIdentity: some View {
    VStack(spacing: 7) {
      if let brand = success.purchase.brandName?.trimmingCharacters(in: .whitespacesAndNewlines), !brand.isEmpty {
        Text(brand.uppercased())
          .font(.caption.weight(.semibold))
          .tracking(2)
          .foregroundStyle(accent)
      }
      Text(success.name)
        .font(.title3.weight(.semibold))
        .multilineTextAlignment(.center)
        .fixedSize(horizontal: false, vertical: true)
    }
    .accessibilityElement(children: .combine)
  }

  private var receipt: some View {
    let layout = typeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: 16))
      : AnyLayout(HStackLayout(alignment: .center, spacing: 12))
    return layout {
      receiptValue("购买日期", value: purchaseDateText)
      receiptValue("数量", value: success.purchase.quantity.formatted())
      receiptValue("合计", value: money(success.purchase.totalPriceCny
        ?? success.purchase.unitPriceCny * Double(success.purchase.quantity)))
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 18)
    .appSurface()
    .accessibilityElement(children: .combine)
  }

  private var purchaseDateText: String {
    guard let date = AppDate.parseISODate(success.purchase.purchaseDate) else {
      return shortDate(success.purchase.purchaseDate)
    }
    return date.formatted(.dateTime.year().month(.twoDigits).day(.twoDigits).locale(AppLanguage.locale))
  }

  private func receiptValue(_ title: String, value: String) -> some View {
    VStack(alignment: typeSize.isAccessibilitySize ? .leading : .center, spacing: 7) {
      Text(LocalizedStringKey(title))
        .font(.caption)
        .foregroundStyle(.secondary)
      Text(value)
        .font(.subheadline.weight(.semibold))
        .monospacedDigit()
        .fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity, alignment: typeSize.isAccessibilitySize ? .leading : .center)
  }
}

private struct PurchaseSuccessArtwork: View {
  @Environment(\.appReduceMotion) private var reduceMotion
  let success: PurchaseSuccess
  let accent: Color
  let appeared: Bool
  let burstProgress: CGFloat

  private var tilt: Double {
    if success.purchase.categoryName?.contains("球拍") == true { return -18 }
    if success.purchase.categoryName?.contains("球鞋") == true { return -8 }
    return 8
  }

  var body: some View {
    GeometryReader { geometry in
      let side = min(geometry.size.width * 0.76, geometry.size.height)
      ZStack {
        Circle()
          .fill(accent.opacity(0.055))
          .overlay { Circle().strokeBorder(accent.opacity(0.08), lineWidth: 1) }
          .frame(width: side * 0.94, height: side * 0.94)

        Circle()
          .trim(from: 0.05, to: 0.75)
          .stroke(accent.opacity(0.16), style: StrokeStyle(lineWidth: 1, dash: [2, 7]))
          .rotationEffect(.degrees(-32))
          .frame(width: side * 1.11, height: side * 1.11)

        if let brand = success.purchase.brandName, !brand.isEmpty {
          Text(brand.uppercased())
            .font(.system(size: 54, weight: .black, design: .rounded))
            .tracking(3)
            .lineLimit(1)
            .minimumScaleFactor(0.35)
            .foregroundStyle(accent.opacity(0.075))
            .padding(.horizontal, 8)
        }

        PurchaseSuccessCourt()
          .fill(accent.opacity(0.035))
          .overlay { PurchaseSuccessCourt().stroke(accent.opacity(0.2), lineWidth: 1) }
          .frame(width: side * 1.12, height: side * 0.26)
          .offset(y: side * 0.40)

        Ellipse()
          .fill(.black.opacity(0.10))
          .frame(width: side * 0.42, height: side * 0.045)
          .blur(radius: 7)
          .offset(y: side * 0.38)

        gearImage
          .frame(width: side * 0.88, height: side * 0.96)
          .rotationEffect(.degrees(tilt))
          .shadow(color: .black.opacity(0.16), radius: 10, x: 0, y: 12)
          .offset(y: appeared || reduceMotion ? -8 : 4)
          .scaleEffect(appeared || reduceMotion ? 1 : 0.94)
          .opacity(appeared || reduceMotion ? 1 : 0)
          .animation(reduceMotion ? nil : .spring(response: 0.46, dampingFraction: 0.82), value: appeared)

        sparkle(size: 17, x: -side * 0.43, y: -side * 0.28)
        sparkle(size: 11, x: side * 0.44, y: -side * 0.04)
        sparkle(size: 21, x: side * 0.32, y: -side * 0.43)

        if !reduceMotion {
          ForEach(0..<3) { group in
            PurchaseSuccessConfetti(progress: burstProgress, group: group)
              .fill(accent.opacity(group == 0 ? 1 : (group == 1 ? 0.65 : 0.35)))
              .opacity(1 - burstProgress)
          }
        }
      }
      .frame(width: geometry.size.width, height: geometry.size.height)
    }
    .accessibilityHidden(true)
    .allowsHitTesting(false)
  }

  @ViewBuilder
  private var gearImage: some View {
    let category = success.purchase.categoryName ?? ""
    let localImage = GearImageResolver.pegboardImage(imageKey: success.imageKey,
      coverImageUrl: success.purchase.gearCoverImageUrl, categoryName: category)
      ?? GearImageResolver.localImage(imageKey: success.imageKey, coverImageUrl: success.purchase.gearCoverImageUrl)
    if let localImage {
      Image(uiImage: localImage).resizable().scaledToFit()
    } else {
      AsyncImage(url: GearImageResolver.preferredImageURL(imageKey: success.imageKey,
        coverImageUrl: success.purchase.gearCoverImageUrl)) { image in
        image.resizable().scaledToFit()
      } placeholder: {
        Image(systemName: category.contains("球拍") ? "tennis.racket" : category.contains("球鞋") ? "shoe" : "figure.badminton")
          .font(.system(size: 76, weight: .ultraLight))
          .foregroundStyle(accent)
      }
    }
  }

  private func sparkle(size: CGFloat, x: CGFloat, y: CGFloat) -> some View {
    Image(systemName: "sparkle")
      .font(.system(size: size, weight: .light))
      .foregroundStyle(accent.opacity(0.50))
      .offset(x: x, y: y)
  }
}

private struct PurchaseSuccessCourt: Shape {
  func path(in rect: CGRect) -> Path {
    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
      CGPoint(x: rect.minX + rect.width * x, y: rect.minY + rect.height * y)
    }
    return Path { path in
      path.move(to: point(0.17, 0))
      path.addLine(to: point(0.83, 0))
      path.addLine(to: point(1, 1))
      path.addLine(to: point(0, 1))
      path.closeSubpath()
      path.move(to: point(0.5, 0))
      path.addLine(to: point(0.5, 1))
      path.move(to: point(0.085, 0.5))
      path.addLine(to: point(0.915, 0.5))
      path.move(to: point(0.25, 0))
      path.addLine(to: point(0.12, 1))
      path.move(to: point(0.75, 0))
      path.addLine(to: point(0.88, 1))
    }
  }
}

private struct PurchaseSuccessConfetti: Shape {
  var progress: CGFloat
  let group: Int

  var animatableData: CGFloat {
    get { progress }
    set { progress = newValue }
  }

  func path(in rect: CGRect) -> Path {
    var path = Path()
    for index in 0..<7 {
      let seed = index * 3 + group
      let angle = CGFloat(195 + (seed * 47) % 150) * .pi / 180
      let distance = min(rect.width, rect.height) * (0.5 + CGFloat(seed % 4) * 0.12)
      let x = rect.midX + cos(angle) * distance * progress
      let y = rect.height * 0.45 + sin(angle) * distance * progress + rect.height * 0.7 * progress * progress
      let piece = Path(roundedRect: CGRect(x: -2, y: -4, width: 4, height: seed.isMultiple(of: 2) ? 8 : 4), cornerRadius: 1)
      path.addPath(piece, transform: CGAffineTransform(rotationAngle: CGFloat(seed) + progress * 5)
        .concatenating(CGAffineTransform(translationX: x, y: y)))
    }
    return path
  }
}

private struct PurchaseSuccessButtonStyle: ButtonStyle {
  @Environment(\.appReduceMotion) private var reduceMotion
  let fill: Color
  let foreground: Color

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.headline)
      .foregroundStyle(foreground)
      .padding(.horizontal, 24)
      .frame(minHeight: 56)
      .background(fill, in: Capsule())
      .opacity(configuration.isPressed ? 0.88 : 1)
      .scaleEffect(configuration.isPressed && !reduceMotion ? 0.98 : 1)
      .animation(reduceMotion ? nil : .easeOut(duration: 0.14), value: configuration.isPressed)
  }
}

#if DEBUG
struct PurchaseSuccessPreview: Identifiable {
  let id = UUID()
  let success: PurchaseSuccess

  static var requested: PurchaseSuccessPreview? {
    let arguments = ProcessInfo.processInfo.arguments
    guard arguments.contains("--purchase-success-preview") else { return nil }
    func option(_ key: String) -> String? {
      guard let index = arguments.firstIndex(of: key), arguments.indices.contains(index + 1) else { return nil }
      return arguments[index + 1]
    }
    let kind: PurchaseSuccess.Kind
    switch option("--success-preview-kind") {
    case "first": kind = .firstGear
    case "repeat": kind = .repeatPurchase
    case "wishlist": kind = .wishlist
    default: kind = .newGear
    }
    var purchase = successPreviewPurchase
    switch option("--success-preview-category") {
    case "shuttle":
      purchase.categoryName = "羽毛球"
      purchase.itemNameSnapshot = "AS-05"
      purchase.modelCode = "AS-05"
      purchase.gearImageKey = "yonex_shuttlecock_as05_main_01"
      purchase.unitPriceCny = 125
      purchase.quantity = 3
      purchase.totalPriceCny = 375
    case "shoes":
      purchase.brandName = "VICTOR"
      purchase.categoryName = "球鞋"
      purchase.itemNameSnapshot = "P8500NL"
      purchase.modelCode = "P8500NL"
      purchase.gearImageKey = "victor_shoes_p8500nl_main_01"
      purchase.unitPriceCny = 780
      purchase.totalPriceCny = 780
    case "custom":
      purchase.brandName = nil
      purchase.categoryName = "其他"
      purchase.itemNameSnapshot = "我的训练装备"
      purchase.modelCode = nil
      purchase.gearImageKey = nil
    default: break
    }
    return PurchaseSuccessPreview(success: PurchaseSuccess(purchase: purchase, kind: kind))
  }
}

private let successPreviewPurchase = PurchaseInput(
  brandName: "YONEX", modelCode: "ASTROX 100 ZZ", categoryId: nil, categoryName: "球拍",
  gearCoverImageUrl: nil, gearImageKey: "yonex_racket_astrox100zz_main_01",
  itemNameSnapshot: "天斧 100 ZZ", unitPriceCny: 1280, quantity: 1,
  totalPriceCny: 1280, purchaseDate: "2026-10-19", channel: nil, itemStatus: .inUse,
  notes: nil, receiptImageUrl: nil
)

#Preview("首次添加") {
  NavigationStack {
    PurchaseSuccessView(success: PurchaseSuccess(purchase: successPreviewPurchase, kind: .firstGear))
  }
}

#Preview("心愿入手 · 深色") {
  NavigationStack {
    PurchaseSuccessView(success: PurchaseSuccess(purchase: successPreviewPurchase, kind: .wishlist))
  }
  .preferredColorScheme(.dark)
}

#Preview("大字体 · English") {
  NavigationStack {
    PurchaseSuccessView(success: PurchaseSuccess(purchase: successPreviewPurchase, kind: .repeatPurchase))
  }
  .environment(\.locale, Locale(identifier: "en"))
  .environment(\.dynamicTypeSize, .accessibility3)
}
#endif
