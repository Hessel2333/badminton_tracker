import SwiftUI
import Observation

@MainActor @Observable
final class AppNavigation {
  var selectedTab: AppTab = .dashboard
  var gearReveal: GearReveal?
  private(set) var gearStackID = UUID()

  struct GearReveal: Identifiable {
    let id = UUID()
    let gearID: String
  }

  func showGear(id: String) {
    gearReveal = GearReveal(gearID: id)
    gearStackID = UUID()
    selectedTab = .gear
  }
}

private struct AppNavigationKey: EnvironmentKey {
  static let defaultValue: AppNavigation? = nil
}

extension EnvironmentValues {
  var appNavigation: AppNavigation? {
    get { self[AppNavigationKey.self] }
    set { self[AppNavigationKey.self] = newValue }
  }
}

enum AppTab: String, CaseIterable, Identifiable {
  case dashboard
  case purchases
  case gear
  case analytics
  case settings

  var id: String { rawValue }

  @MainActor
  @ViewBuilder
  var content: some View {
    switch self {
    case .dashboard:
      DashboardView()
    case .purchases:
      PurchasesView()
    case .gear:
      GearView()
    case .analytics:
      AnalyticsView()
    case .settings:
      AppSettingsView()
    }
  }

  @ViewBuilder
  var label: some View {
    switch self {
    case .dashboard:
      Label("总览", systemImage: "rectangle.grid.2x2")
    case .purchases:
      Label("装备库", systemImage: "bag")
    case .gear:
      Label("我的装备", systemImage: "square.grid.2x2")
    case .analytics:
      Label("分析", systemImage: "chart.bar.xaxis")
    case .settings:
      Label("设置", systemImage: "gearshape")
    }
  }
}
