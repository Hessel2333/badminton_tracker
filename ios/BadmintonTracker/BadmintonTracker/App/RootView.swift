import SwiftUI
import UIKit

struct RootView: View {
  @State private var navigation = AppNavigation()
  @Environment(AppSession.self) private var session
  @Environment(\.scenePhase) private var scenePhase
  @AppStorage("app.language") private var language = "system"
  @AppStorage("app.theme") private var themeRawValue = AppTheme.system.rawValue
  @AppStorage(AppIconChoice.preferenceKey) private var iconRawValue = AppIconChoice.current.rawValue
  #if DEBUG
  @State private var successPreview = PurchaseSuccessPreview.requested
  #endif

  var body: some View {
    AppTabView(navigation: navigation)
    .safeAreaInset(edge: .bottom) { UndoOperationBar() }
    #if DEBUG
    .sheet(item: $successPreview) { preview in
      NavigationStack { PurchaseSuccessView(success: preview.success) }
        .modifier(InteractionAccessibilityPreview())
    }
    #endif
    .modifier(InteractionAccessibilityPreview())
    .environment(\.appNavigation, navigation)
    .environment(\.locale, AppLanguage.locale(for: language))
    .environment(\.appAccentColor, selectedIcon.accentColor)
    .tint(selectedIcon.accentColor)
    .preferredColorScheme((AppTheme(rawValue: themeRawValue) ?? .system).colorScheme)
    .onAppear { synchronizeIcon() }
    .onChange(of: scenePhase) { _, phase in
      if phase == .active { synchronizeIcon() }
    }
  }

  private var selectedIcon: AppIconChoice {
    AppIconChoice(rawValue: iconRawValue) ?? .blue
  }

  private func synchronizeIcon() {
    iconRawValue = AppIconChoice.current.rawValue
  }
}

enum AppTheme: String, CaseIterable, Identifiable {
  case system
  case light
  case dark

  var id: String { rawValue }

  var label: String {
    switch self {
    case .system:
      "跟随系统"
    case .light:
      "浅色"
    case .dark:
      "深色"
    }
  }

  var colorScheme: ColorScheme? {
    switch self {
    case .system:
      nil
    case .light:
      .light
    case .dark:
      .dark
    }
  }
}

private struct AppTabView: View {
  @Environment(AppSession.self) private var session
  @Bindable var navigation: AppNavigation

  var body: some View {
    Group {
      if #available(iOS 18, *) {
        TabView(selection: $navigation.selectedTab) {
          ForEach(AppTab.allCases) { tab in
            Tab(value: tab) {
              NavigationStack { tab.content }
                .id(tab == .gear ? navigation.gearStackID : nil)
            } label: { tab.label }
          }
        }
        .tabViewStyle(.sidebarAdaptable)
      } else {
        TabView(selection: $navigation.selectedTab) {
          ForEach(AppTab.allCases) { tab in
            NavigationStack { tab.content }
              .id(tab == .gear ? navigation.gearStackID : nil)
              .tabItem { tab.label }
              .tag(tab)
          }
        }
      }
    }
    .task {
      await session.refreshAll()
    }
  }
}

private struct UndoOperationBar: View {
  @Environment(AppSession.self) private var session
  @State private var error: String?
  var body: some View {
    if let operation = session.undoOperation {
      HStack {
        Text(AppLanguage.text(message(for: operation))).font(.subheadline)
        Spacer(minLength: 8)
        Button("撤销") {
          Task { if !(await session.undoLastOperation()) { error = session.errorMessage } }
        }
        .frame(minWidth: 44, minHeight: 44)
        .disabled(session.isUndoing)
        Button { session.undoOperation = nil } label: { Image(systemName: "xmark") }
          .disabled(session.isUndoing)
          .accessibilityLabel("关闭提示")
          .frame(minWidth: 44, minHeight: 44)
      }
      .padding(.horizontal)
      .background(Color(.secondarySystemBackground))
      .operationFailure($error)
      .onAppear { UIAccessibility.post(notification: .announcement, argument: AppLanguage.text(message(for: operation))) }
    }
  }
  private func message(for operation: AppSession.UndoOperation) -> String {
    switch operation {
    case .purchase: "购买记录已删除"
    case .wishlist: "心愿已删除"
    case .consumption: "消耗已记录"
    }
  }
}

enum AppLanguage {
  static func locale(for choice: String) -> Locale {
    if choice != "system" { return Locale(identifier: choice) }
    return Locale(identifier: Locale.preferredLanguages.first?.hasPrefix("zh") == true ? "zh-Hans" : "en")
  }
  static var locale: Locale { locale(for: UserDefaults.standard.string(forKey: "app.language") ?? "system") }
  static var bundle: Bundle {
    let code = locale.language.languageCode?.identifier == "zh" ? "zh-Hans" : "en"
    return Bundle.main.path(forResource: code, ofType: "lproj").flatMap(Bundle.init(path:)) ?? .main
  }
  static func text(_ key: String) -> String { bundle.localizedString(forKey: key, value: key, table: nil) }
}

private struct InteractionAccessibilityPreview: ViewModifier {
  @Environment(\.dynamicTypeSize) private var size
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
  func body(content: Content) -> some View {
    #if DEBUG
    let args = ProcessInfo.processInfo.arguments
    content
      .environment(\.dynamicTypeSize, args.contains("--interaction-large-type") ? .accessibility5 : size)
    #else
    content
    #endif
  }
}

private struct AppAccentColorKey: EnvironmentKey {
  static let defaultValue = SemanticTint.accent
}

extension EnvironmentValues {
  var appAccentColor: Color {
    get { self[AppAccentColorKey.self] }
    set { self[AppAccentColorKey.self] = newValue }
  }

  var appReduceMotion: Bool {
    #if DEBUG
    accessibilityReduceMotion || ProcessInfo.processInfo.arguments.contains("--interaction-reduced-effects")
    #else
    accessibilityReduceMotion
    #endif
  }
  var appReduceTransparency: Bool {
    #if DEBUG
    accessibilityReduceTransparency || ProcessInfo.processInfo.arguments.contains("--interaction-reduced-effects")
    #else
    accessibilityReduceTransparency
    #endif
  }
}
