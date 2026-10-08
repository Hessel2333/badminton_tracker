import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Shared submission and draft protection for modal editors.
private struct EditorActions: ViewModifier {
  @Environment(\.dismiss) private var dismiss
  @Environment(AppSession.self) private var session
  let title: String
  let isValid: Bool
  let isBusy: Bool
  let draft: [String]
  let ready: Bool
  let draftKey: String?
  let save: () async -> Bool
  @State private var baseline: [String]?
  @State private var isSaving = false
  @State private var showingDiscard = false
  @State private var failure: String?

  private var hasChanges: Bool { baseline.map { $0 != draft } ?? false }

  func body(content: Content) -> some View {
    content
      .disabled(isSaving)
      .scrollDismissesKeyboard(.interactively)
      .interactiveDismissDisabled(isSaving || isBusy || hasChanges)
      .background(DismissAttemptObserver(canDismiss: !(isSaving || isBusy || hasChanges)) {
        if hasChanges && !isSaving && !isBusy { showingDiscard = true }
      })
      .onAppear { if ready && baseline == nil { baseline = draft } }
      .onChange(of: ready) { _, value in if value { baseline = draft } }
      .onChange(of: draft) { _, value in
        if ready, hasChanges, let draftKey { PurchaseDraftStore.save(value, key: draftKey) }
      }
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("取消") {
            if hasChanges { showingDiscard = true } else { dismiss() }
          }
          .disabled(isSaving || isBusy)
        }
        ToolbarItem(placement: .confirmationAction) {
          Button {
            guard !isSaving && !isBusy else { return }
            isSaving = true
            Task { @MainActor in
              let saved = await save()
              isSaving = false
              if saved {
                if let draftKey { PurchaseDraftStore.remove(key: draftKey) }
                UIAccessibility.post(notification: .announcement, argument: AppLanguage.text("已保存"))
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                dismiss()
              }
              else { failure = session.errorMessage ?? "未能保存，请重试。你的输入仍然保留。" }
            }
          } label: {
            if isSaving { ProgressView().accessibilityLabel("正在保存") }
            else { Text(LocalizedStringKey(title)).fontWeight(.semibold) }
          }
          .disabled(!isValid || isBusy || isSaving || !ready)
        }
        ToolbarItemGroup(placement: .keyboard) {
          Spacer()
          Button("完成") {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
          }
        }
      }
      .confirmationDialog("放弃未保存的修改？", isPresented: $showingDiscard, titleVisibility: .visible) {
        if draftKey != nil {
          Button("保留草稿并退出") { dismiss() }
        }
        Button("放弃修改", role: .destructive) {
          if let draftKey { PurchaseDraftStore.remove(key: draftKey) }
          dismiss()
        }
        Button("继续编辑", role: .cancel) { }
      }
      .alert("未能保存", isPresented: Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })) {
        Button("继续编辑", role: .cancel) { failure = nil }
      } message: { Text(AppLanguage.text(failure ?? "请重试。")) }
  }
}

extension View {
  func operationFailure(_ message: Binding<String?>) -> some View {
    alert("操作未完成", isPresented: Binding(get: { message.wrappedValue != nil },
      set: { if !$0 { message.wrappedValue = nil } })) {
      Button("好", role: .cancel) { message.wrappedValue = nil }
    } message: { Text(AppLanguage.text(message.wrappedValue ?? "请重试。")) }
  }

  func editorActions(title: String = "保存", isValid: Bool = true, isBusy: Bool = false,
                     draft: [String], ready: Bool = true, draftKey: String? = nil, save: @escaping () async -> Bool) -> some View {
    modifier(EditorActions(title: title, isValid: isValid, isBusy: isBusy, draft: draft, ready: ready, draftKey: draftKey, save: save))
  }
}

struct LabeledInput: View {
  let title: String
  @Binding var text: String
  var prompt = "选填"
  var keyboard: UIKeyboardType = .default
  var unit: String? = nil

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
    LabeledContent(LocalizedStringKey(title)) {
      HStack(spacing: 6) {
        TextField(LocalizedStringKey(prompt), text: $text)
          .keyboardType(keyboard)
          .multilineTextAlignment(.trailing)
          .accessibilityLabel(title)
        if let unit { Text(LocalizedStringKey(unit)).foregroundStyle(.secondary) }
      }
    }
    if keyboard == .decimalPad && !NumericInput.validOptional(text) {
      Text("请输入有效的非负数。").font(.caption).foregroundStyle(.red)
    }
    }
  }
}

struct PageHeader: View {
  let title: String
  let subtitle: String?
  let systemImage: String

  var body: some View {
    HStack(alignment: .center, spacing: 14) {
      Image(systemName: systemImage)
        .font(.title3.weight(.semibold))
        .foregroundStyle(.teal)
        .frame(width: 42, height: 42)
        .background(.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

      VStack(alignment: .leading, spacing: 3) {
        Text(LocalizedStringKey(title))
          .font(.title2.bold())
          .foregroundStyle(.primary)
        if let subtitle {
          Text(LocalizedStringKey(subtitle))
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
      }
      Spacer(minLength: 0)
    }
    .padding(.horizontal)
    .padding(.top, 12)
  }
}

struct MetricCard: View {
  let title: String
  let value: String
  let footnote: String

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(LocalizedStringKey(title))
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
      Text(value)
        .font(.title2.bold())
        .monospacedDigit()
        .fixedSize(horizontal: false, vertical: true)
        .foregroundStyle(.primary)
        .minimumScaleFactor(0.8)
      Text(LocalizedStringKey(footnote))
        .font(.caption)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
    .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .stroke(.quaternary, lineWidth: 1)
    )
    .accessibilityElement(children: .combine)
  }
}

enum SemanticTint {
  static let active = Color(uiColor: .systemGreen)
  static let consumed = Color.secondary
  static let stored = Color(uiColor: .systemOrange)
  static let retired = Color(uiColor: .systemPurple)
  static let consumption = Color(uiColor: .systemOrange)
  static let destructive = Color(uiColor: .systemRed)
}

extension PurchaseRecord {
  var inventoryTint: Color {
    if consumedQuantity >= quantity { return SemanticTint.consumed }
    if consumedQuantity > 0 { return SemanticTint.consumption }
    switch itemStatus {
    case .inUse: return SemanticTint.active
    case .stored: return SemanticTint.stored
    case .usedUp: return SemanticTint.consumed
    case .wornOut: return SemanticTint.retired
    }
  }
  var inventorySymbol: String {
    if consumedQuantity >= quantity { return "checkmark.circle.fill" }
    if consumedQuantity > 0 { return "circle.lefthalf.filled" }
    switch itemStatus {
    case .inUse: return "play.circle.fill"
    case .stored: return "archivebox.fill"
    case .usedUp: return "checkmark.circle.fill"
    case .wornOut: return "pause.circle.fill"
    }
  }
}

struct StatusPill: View {
  @Environment(\.colorSchemeContrast) private var contrast
  let text: String
  var color: Color = .secondary
  var systemImage: String? = nil
  var width: CGFloat? = nil

  var body: some View {
    HStack(spacing: 4) {
      if let systemImage { Image(systemName: systemImage).foregroundStyle(color).accessibilityHidden(true) }
      Text(LocalizedStringKey(text)).foregroundStyle(.primary)
    }
    .font(.caption.weight(.semibold))
    .padding(.horizontal, 10)
    .padding(.vertical, 5)
    .frame(width: width)
    .background(color.opacity(contrast == .increased ? 0.22 : 0.12), in: Capsule())
    .overlay(Capsule().strokeBorder(color.opacity(contrast == .increased ? 0.8 : 0.4), lineWidth: 1))
    .accessibilityElement(children: .combine)
  }
}

struct EmptyStateView: View {
  let title: String
  let message: String
  let systemImage: String
  var actionTitle: String? = nil
  var action: (() -> Void)? = nil

  var body: some View {
    VStack(spacing: 12) {
      Image(systemName: systemImage)
        .font(.largeTitle)
        .foregroundStyle(.secondary)
      Text(LocalizedStringKey(title))
        .font(.headline)
      Text(LocalizedStringKey(message))
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
      if let actionTitle, let action {
        Button(LocalizedStringKey(actionTitle), action: action)
          .buttonStyle(.borderedProminent)
          .controlSize(.large)
          .padding(.top, 4)
      }
    }
    .frame(maxWidth: .infinity)
    .padding(28)
    .background(.background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
  }
}

struct LoadingStateView: View {
  let title: String
  let message: String

  var body: some View {
    VStack(spacing: 14) {
      ProgressView()
      Text(LocalizedStringKey(title))
        .font(.headline)
      Text(LocalizedStringKey(message))
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(28)
    .background(.background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
  }
}

struct RemoteImageView: View {
  @Environment(\.appReduceMotion) private var reduceMotion
  let url: URL?
  let systemImage: String
  var imageKey: String? = nil
  var coverImageUrl: String? = nil
  var categoryName: String? = nil

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(Color(.secondarySystemGroupedBackground))

      if let normalizedImage = normalizedLocalImage {
        Image(uiImage: normalizedImage)
          .resizable()
          .scaledToFit()
          .padding(6)
      } else if let localImage = GearImageResolver.localImage(imageKey: imageKey, coverImageUrl: coverImageUrl) {
        Image(uiImage: localImage)
          .resizable()
          .scaledToFit()
          .padding(6)
      } else if let url {
        AsyncImage(url: url, transaction: Transaction(animation: reduceMotion ? nil : .easeInOut)) { phase in
          switch phase {
          case .empty:
            ProgressView()
              .scaleEffect(0.75)
          case .success(let image):
            image
              .resizable()
              .scaledToFit()
              .padding(6)
          case .failure:
            Image(systemName: placeholderSymbol)
              .foregroundStyle(.secondary)
          @unknown default:
            Image(systemName: placeholderSymbol)
              .foregroundStyle(.secondary)
          }
        }
      } else {
        Image(systemName: placeholderSymbol)
          .foregroundStyle(.secondary)
      }
    }
    .clipped()
    .accessibilityHidden(true)
  }

  private var placeholderSymbol: String {
    if categoryName?.contains("球拍") == true { return "tennis.racket" }
    if categoryName?.contains("球鞋") == true { return "shoe" }
    if categoryName?.contains("羽毛球") == true { return "figure.badminton" }
    return systemImage
  }

  private var normalizedLocalImage: UIImage? {
    guard let categoryName,
          categoryName.contains("球拍") else {
      return nil
    }

    return GearImageResolver.pegboardImage(
      imageKey: imageKey,
      coverImageUrl: coverImageUrl,
      categoryName: categoryName
    )
  }
}

struct ErrorBanner: View {
  let message: String

  var body: some View {
    HStack(spacing: 10) {
      Image(systemName: "exclamationmark.triangle.fill")
      Text(LocalizedStringKey(message))
        .font(.footnote)
      Spacer(minLength: 0)
    }
    .foregroundStyle(.orange)
    .padding(12)
    .background(.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    .padding(.horizontal)
  }
}

struct RefreshToolbarButton: View {
  let isLoading: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      if isLoading {
        ProgressView()
      } else {
        Image(systemName: "arrow.clockwise")
      }
    }
    .accessibilityLabel("刷新")
  }
}

func money(_ value: Double?) -> String {
  guard let value else { return "未设置" }
  return value.formatted(.currency(code: "CNY").precision(.fractionLength(0...2)).locale(AppLanguage.locale))
}

func shortDate(_ rawValue: String) -> String {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  if let date = formatter.date(from: rawValue) {
    return date.formatted(.dateTime.year().month().day().locale(AppLanguage.locale))
  }
  formatter.formatOptions = [.withInternetDateTime]
  if let date = formatter.date(from: rawValue) {
    return date.formatted(.dateTime.year().month().day().locale(AppLanguage.locale))
  }
  return rawValue
}

struct AppSettingsView: View {
  @AppStorage("app.language") private var language = "system"
  @AppStorage("backup.lastExport") private var lastExport: Double = 0
  @Environment(AppSession.self) private var session
  @AppStorage("app.theme") private var themeRawValue = AppTheme.system.rawValue
  @State private var backupDocument = LocalBackupDocument(data: Data())
  @State private var showingExporter = false
  @State private var showingImporter = false
  @State private var showingResetConfirmation = false
  @State private var backupMessage: String?
  @State private var pendingBackup: PreparedBackup?
  @State private var hasRecovery = FileManager.default.fileExists(atPath: AppSession.recoveryBackupURL.path)

  var body: some View {
    List {
      Section("外观") {
        Picker("显示模式", selection: selectedTheme) {
          ForEach(AppTheme.allCases) { theme in
            Text(LocalizedStringKey(theme.label)).tag(theme)
          }
        }
        .pickerStyle(.segmented)
      }

      Section("个性化") {
        Picker("语言", selection: $language) {
          Text("跟随系统").tag("system")
          Text("简体中文").tag("zh-Hans")
          Text("English").tag("en")
        }

        NavigationLink {
          AppIconSettingsView()
        } label: {
          HStack(spacing: 12) {
            Image(currentIcon.previewAssetName)
              .resizable()
              .scaledToFit()
              .frame(width: 32, height: 32)
              .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text("App 图标")
            Spacer(minLength: 0)
            Text(currentIcon.title)
              .foregroundStyle(.secondary)
          }
        }
      }

      Section("备份与恢复") {
        if lastExport > 0 {
          LabeledContent("最近导出") { Text(Date(timeIntervalSince1970: lastExport), style: .date) }
        }


        Button {
          exportBackup()
        } label: {
          Label("导出备份包", systemImage: "square.and.arrow.up")
        }

        Button {
          showingImporter = true
        } label: {
          Label("导入备份包", systemImage: "square.and.arrow.down")
        }

        if hasRecovery {
          Button {
            do {
              backupDocument = LocalBackupDocument(data: try Data(contentsOf: AppSession.recoveryBackupURL))
              showingExporter = true
            } catch { backupMessage = error.localizedDescription }
          } label: {
            Label("导出上次恢复前的数据", systemImage: "clock.arrow.circlepath")
          }
        }


        if let backupMessage {
          Text(backupMessage)
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      }
      Section {
        Button(role: .destructive) {
          showingResetConfirmation = true
        } label: {
          Label("清空本地数据", systemImage: "trash")
        }
      } footer: {
        Text("清空不会删除已导出的备份或恢复点。")
      }
    }
    .navigationTitle("设置")
    .navigationBarTitleDisplayMode(.inline)
    .fileExporter(
      isPresented: $showingExporter,
      document: backupDocument,
      contentType: .badmintonTrackerBackup,
      defaultFilename: "badminton-tracker-backup.btbackup"
    ) { result in
      switch result {
      case .success:
        lastExport = Date().timeIntervalSince1970
        backupMessage = "备份已导出。"
      case .failure(let error):
        backupMessage = error.localizedDescription
      }
    }
    .fileImporter(isPresented: $showingImporter, allowedContentTypes: [.badmintonTrackerBackup, .data, .package, .json]) { result in
      importBackup(result)
    }
    .sheet(item: $pendingBackup, onDismiss: {
      hasRecovery = FileManager.default.fileExists(atPath: AppSession.recoveryBackupURL.path)
    }) { backup in
      BackupRestorePreview(backup: backup)
    }
    .confirmationDialog("清空这台设备上的全部数据？", isPresented: $showingResetConfirmation, titleVisibility: .visible) {
      Button("清空全部数据", role: .destructive) {
        Task {
          await session.resetLocalData()
          backupMessage = session.errorMessage ?? "本地数据已清空。"
        }
      }
    } message: {
      Text("购买记录、装备墙、心愿和洞洞板布局都会被删除。建议先导出备份，此操作无法撤销。")
    }
  }

  private var selectedTheme: Binding<AppTheme> {
    Binding {
      AppTheme(rawValue: themeRawValue) ?? .system
    } set: { theme in
      themeRawValue = theme.rawValue
    }
  }

  private var currentIcon: AppIconChoice {
    AppIconChoice.allCases.first { $0.alternateIconName == UIApplication.shared.alternateIconName } ?? .blue
  }

  private func exportBackup() {
    do {
      backupDocument = LocalBackupDocument(data: try session.exportLocalBackupPackageData())
      backupMessage = nil
      showingExporter = true
    } catch {
      backupMessage = error.localizedDescription
    }
  }

  private func importBackup(_ result: Result<URL, Error>) {
    do {
      let url = try result.get()
      let didAccess = url.startAccessingSecurityScopedResource()
      defer { if didAccess { url.stopAccessingSecurityScopedResource() } }
      if url.hasDirectoryPath {
        pendingBackup = try LocalDataStore.prepareBackup(package: FileWrapper(url: url, options: .immediate))
      } else {
        pendingBackup = try LocalDataStore.prepareBackup(data: Data(contentsOf: url),
          isLegacy: url.pathExtension.lowercased() == "json")
      }
      backupMessage = nil
    } catch CocoaError.userCancelled {
      // Closing the document picker is not a failed restore.
    } catch { backupMessage = error.localizedDescription }
  }
}

private struct BackupRestorePreview: View {
  @Environment(AppSession.self) private var session
  let backup: PreparedBackup

  var body: some View {
    NavigationStack {
      Form {
        Section("备份内容") {
          if let date = backup.exportedAt { LabeledContent("备份时间", value: shortDate(date)) }
          LabeledContent("购买记录", value: "\(backup.purchaseCount) 条")
          LabeledContent("心愿", value: "\(backup.wishlistCount) 条")
          LabeledContent("照片文件", value: "\(backup.photoCount) 个")
        }
        Section {
          Label("将替换当前记录", systemImage: "exclamationmark.triangle")
            .foregroundStyle(.orange)
          Text("这台设备上的 \(session.purchases.count) 条购买记录和 \(session.wishlistItems.count) 条心愿将被备份中的记录替换，相关装备与布局也会更新。")
          Text("恢复前会自动保存当前数据，可在“备份与恢复”中导出。")
            .foregroundStyle(.secondary)
          if backup.isLegacy {
            Text("此旧版备份不包含照片文件。")
              .foregroundStyle(.secondary)
          }
        }
      }
      .navigationTitle("恢复备份")
      .navigationBarTitleDisplayMode(.inline)
      .editorActions(title: "替换并恢复", draft: []) {
        await session.restorePreparedBackup(backup)
      }
    }
  }
}

private struct LocalBackupDocument: FileDocument {
  static var readableContentTypes: [UTType] { [.badmintonTrackerBackup] }

  var data: Data

  init(data: Data) {
    self.data = data
  }

  init(configuration: ReadConfiguration) throws {
    data = configuration.file.regularFileContents ?? Data()
  }

  func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
    FileWrapper(regularFileWithContents: data)
  }
}

private extension UTType {
  static let badmintonTrackerBackup = UTType(exportedAs: "com.tian.badminton-tracker.backup", conformingTo: .data)
}

private struct AppIconSettingsView: View {
  @State private var selectedIconName = UIApplication.shared.alternateIconName
  @State private var isChangingIcon = false
  @State private var iconErrorMessage: String?

  var body: some View {
    List {
      Section {
        ForEach(AppIconChoice.allCases) { choice in
          Button {
            applyIcon(choice)
          } label: {
            HStack(spacing: 14) {
              Image(choice.previewAssetName)
                .resizable()
                .scaledToFit()
                .frame(width: 52, height: 52)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                  RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(.quaternary, lineWidth: 1)
                )

              VStack(alignment: .leading, spacing: 3) {
                Text(LocalizedStringKey(choice.title))
                  .font(.body.weight(.medium))
                  .foregroundStyle(.primary)
                Text(LocalizedStringKey(choice.subtitle))
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }

              Spacer(minLength: 0)

              if selectedIconName == choice.alternateIconName {
                Image(systemName: "checkmark.circle.fill")
                  .foregroundStyle(.blue)
              }
            }
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .disabled(isChangingIcon)
        }
      } footer: {
        if let iconErrorMessage {
          Text(iconErrorMessage)
            .foregroundStyle(.red)
        }
      }
    }
    .navigationTitle("App 图标")
    .navigationBarTitleDisplayMode(.inline)
  }

  private func applyIcon(_ choice: AppIconChoice) {
    guard UIApplication.shared.supportsAlternateIcons else {
      iconErrorMessage = "当前设备暂不支持更换 App 图标。"
      return
    }

    guard selectedIconName != choice.alternateIconName else {
      return
    }

    iconErrorMessage = nil
    isChangingIcon = true
    UIApplication.shared.setAlternateIconName(choice.alternateIconName) { error in
      DispatchQueue.main.async {
        isChangingIcon = false
        if error == nil {
          selectedIconName = choice.alternateIconName
        } else {
          iconErrorMessage = "图标暂时无法更换，请稍后再试。"
        }
      }
    }
  }
}

private enum AppIconChoice: String, CaseIterable, Identifiable {
  case blue
  case green
  case victorBlue
  case red
  case silver
  case orange
  case purple
  case aqua

  var id: String { rawValue }

  var title: String {
    switch self {
    case .blue:
      return "经典蓝"
    case .green:
      return "御三家-绿"
    case .victorBlue:
      return "御三家-蓝"
    case .red:
      return "御三家-红"
    case .silver:
      return "曜岩银"
    case .orange:
      return "工业橙"
    case .purple:
      return "虚空紫"
    case .aqua:
      return "青羽"
    }
  }

  var subtitle: String {
    switch self {
    case .blue:
      return "默认图标"
    case .green:
      return "清爽训练感"
    case .victorBlue:
      return "沉稳比赛感"
    case .red:
      return "醒目的红色主题"
    case .silver:
      return "克制的中性色"
    case .orange:
      return "明亮的活力色"
    case .purple:
      return "轻快的紫色主题"
    case .aqua:
      return "更接近羽痕气质"
    }
  }

  var alternateIconName: String? {
    switch self {
    case .blue:
      nil
    case .green:
      "AppIconGreen"
    case .victorBlue:
      "AppIconVictorBlue"
    case .red:
      "AppIconRed"
    case .silver:
      "AppIconSilver"
    case .orange:
      "AppIconOrange"
    case .purple:
      "AppIconPurple"
    case .aqua:
      "AppIconAqua"
    }
  }

  var previewAssetName: String {
    switch self {
    case .blue:
      "IconPreviewBlue"
    case .green:
      "IconPreviewGreen"
    case .victorBlue:
      "IconPreviewVictorBlue"
    case .red:
      "IconPreviewRed"
    case .silver:
      "IconPreviewSilver"
    case .orange:
      "IconPreviewOrange"
    case .purple:
      "IconPreviewPurple"
    case .aqua:
      "IconPreviewAqua"
    }
  }
}

struct RacketStringSelectionField: View {
  @Binding var stringName: String

  private let customChoice = "__custom_string__"

  private var selection: Binding<String> {
    Binding(
      get: {
        let normalized = RacketStringOptions.normalizedStringName(stringName)
        guard let normalized, RacketStringOptions.isPopularString(normalized) else {
          return customChoice
        }
        return normalized
      },
      set: { value in
        if value == customChoice {
          if RacketStringOptions.isPopularString(stringName) {
            stringName = ""
          }
        } else {
          stringName = value
        }
      }
    )
  }

  var body: some View {
    Picker("球线", selection: selection) {
      ForEach(RacketStringOptions.popularStrings, id: \.self) { option in
        Text(option).tag(option)
      }
      Text("手动输入").tag(customChoice)
    }

    if selection.wrappedValue == customChoice {
      TextField("球线名称", text: $stringName)
    }
  }
}

struct PurchaseChannelSelectionField: View {
  @Binding var channel: String

  private let customChoice = "__custom_channel__"

  private var selection: Binding<String> {
    Binding(
      get: {
        PurchaseChannelOptions.normalizedPreset(channel) ?? customChoice
      },
      set: { value in
        if value == customChoice {
          if PurchaseChannelOptions.isPreset(channel) {
            channel = ""
          }
        } else {
          channel = value
        }
      }
    )
  }

  var body: some View {
    Picker("渠道", selection: selection) {
      ForEach(PurchaseChannelOptions.presets, id: \.self) { option in
        Text(option).tag(option)
      }
      Text("手动输入").tag(customChoice)
    }

    if selection.wrappedValue == customChoice {
      TextField("渠道名称", text: $channel)
    }
  }
}

private struct AdaptivePickerStyle: ViewModifier {
  @Environment(\.dynamicTypeSize) private var typeSize
  @ViewBuilder func body(content: Content) -> some View {
    if typeSize >= .xxxLarge { content.pickerStyle(.menu) }
    else { content.pickerStyle(.segmented) }
  }
}

extension View {
  func adaptivePickerStyle() -> some View { modifier(AdaptivePickerStyle()) }
}

struct QuantityInput: View {
  @Binding var value: Int
  var range: ClosedRange<Int> = 1...9999
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      LabeledContent("数量") {
        TextField("数量", value: $value, format: .number.grouping(.never))
          .keyboardType(.numberPad)
          .multilineTextAlignment(.trailing)
          .accessibilityLabel("数量")
      }
      Stepper("调整数量", value: $value, in: range)
        .accessibilityValue(String(value))
      if !range.contains(value) {
        Text("请输入 \(range.lowerBound)–\(range.upperBound) 之间的数量")
          .font(.caption).foregroundStyle(.red)
      }
    }
  }
}

/// Versioned, device-local drafts. No business records are created until Save succeeds.
enum PurchaseDraftStore {
  static func load(key: String, defaults: UserDefaults = .standard) -> [String]? {
    guard let values = defaults.stringArray(forKey: "purchase.draft.v1." + key), values.count == 22 else { return nil }
    return values
  }
  static func save(_ values: [String], key: String, defaults: UserDefaults = .standard) {
    guard values.count == 22 else { return }
    defaults.set(values, forKey: "purchase.draft.v1." + key)
  }
  static func remove(key: String, defaults: UserDefaults = .standard) {
    defaults.removeObject(forKey: "purchase.draft.v1." + key)
  }
}

enum NumericInput {
  static func validOptional(_ raw: String) -> Bool {
    raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || Double(raw).map { $0.isFinite && $0 >= 0 } == true
  }
}

private struct EquipmentZoomSource: ViewModifier {
  let id: String
  let namespace: Namespace.ID
  @Environment(\.appReduceMotion) private var reduceMotion
  @ViewBuilder func body(content: Content) -> some View {
    if #available(iOS 18, *), !reduceMotion { content.matchedTransitionSource(id: id, in: namespace) }
    else { content }
  }
}
private struct EquipmentZoomDestination: ViewModifier {
  let id: String
  let namespace: Namespace.ID
  let enabled: Bool
  @Environment(\.appReduceMotion) private var reduceMotion
  @ViewBuilder func body(content: Content) -> some View {
    if #available(iOS 18, *), enabled && !reduceMotion { content.navigationTransition(.zoom(sourceID: id, in: namespace)) }
    else { content }
  }
}
extension View {
  func equipmentZoomSource(id: String, namespace: Namespace.ID) -> some View {
    modifier(EquipmentZoomSource(id: id, namespace: namespace))
  }
  func equipmentZoomDestination(id: String, namespace: Namespace.ID, enabled: Bool) -> some View {
    modifier(EquipmentZoomDestination(id: id, namespace: namespace, enabled: enabled))
  }
}

/// Switch dense rows to a reading order that works at accessibility text sizes.
struct AdaptiveRow<Content: View>: View {
  @Environment(\.dynamicTypeSize) private var typeSize
  var spacing: CGFloat = 12
  var alignment: VerticalAlignment = .top
  @ViewBuilder var content: Content
  var body: some View {
    let layout = typeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: spacing))
      : AnyLayout(HStackLayout(alignment: alignment, spacing: spacing))
    layout { content }
  }
}

/// Receives the system's blocked sheet-dismiss gesture without replacing its animation.
private struct DismissAttemptObserver: UIViewControllerRepresentable {
  let canDismiss: Bool
  let onAttempt: () -> Void
  func makeCoordinator() -> Coordinator { Coordinator() }
  func makeUIViewController(context: Context) -> ObserverController {
    let controller = ObserverController()
    controller.view.isUserInteractionEnabled = false
    controller.view.backgroundColor = .clear
    return controller
  }
  func updateUIViewController(_ controller: ObserverController, context: Context) {
    context.coordinator.canDismiss = canDismiss
    context.coordinator.onAttempt = onAttempt
    let coordinator = context.coordinator
    controller.attach = { [weak controller, weak coordinator] in
      guard let coordinator else { return }
      var ancestor: UIViewController? = controller
      while let current = ancestor {
        if current.presentingViewController != nil, let presentation = current.presentationController {
          presentation.delegate = coordinator
          return
        }
        ancestor = current.parent
      }
    }
    DispatchQueue.main.async { controller.attach?() }
  }
  final class ObserverController: UIViewController {
    var attach: (() -> Void)?
    override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); attach?() }
  }
  final class Coordinator: NSObject, UIAdaptivePresentationControllerDelegate {
    var canDismiss = true
    var onAttempt: (() -> Void)?
    func presentationControllerShouldDismiss(_ presentationController: UIPresentationController) -> Bool { canDismiss }
    func presentationControllerDidAttemptToDismiss(_ presentationController: UIPresentationController) { onAttempt?() }
  }
}
