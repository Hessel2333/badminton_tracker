import SwiftUI
import UIKit

struct RootView: View {
  @Environment(AppSession.self) private var session
  @AppStorage("app.language") private var language = "system"
  @AppStorage("app.theme") private var themeRawValue = AppTheme.system.rawValue

  var body: some View {
    AppTabView()
    .safeAreaInset(edge: .bottom) { UndoOperationBar() }
    .modifier(InteractionAccessibilityPreview())
    .environment(\.locale, AppLanguage.locale(for: language))
    .tint(.blue)
    .preferredColorScheme((AppTheme(rawValue: themeRawValue) ?? .system).colorScheme)
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
  @State private var selectedTab: AppTab = .dashboard

  var body: some View {
    Group {
      if #available(iOS 18, *) {
        TabView(selection: $selectedTab) {
          ForEach(AppTab.allCases) { tab in
            Tab(value: tab) {
              NavigationStack { tab.content }
            } label: { tab.label }
          }
        }
        .tabViewStyle(.sidebarAdaptable)
      } else {
        TabView(selection: $selectedTab) {
          ForEach(AppTab.allCases) { tab in
            NavigationStack { tab.content }
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
        .disabled(session.isUndoing)
        Button { session.undoOperation = nil } label: { Image(systemName: "xmark") }
          .accessibilityLabel("关闭提示")
          .frame(minWidth: 44, minHeight: 44)
      }
      .padding(.horizontal)
      .background(Color(.secondarySystemBackground))
      .operationFailure($error)
      .onAppear { UIAccessibility.post(notification: .announcement, argument: message(for: operation)) }
    }
  }
  private func message(for operation: AppSession.UndoOperation) -> String {
    switch operation {
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

extension EnvironmentValues {
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
