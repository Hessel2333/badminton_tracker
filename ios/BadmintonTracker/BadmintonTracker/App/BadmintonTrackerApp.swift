import SwiftUI

@main
struct BadmintonTrackerApp: App {
  @State private var session = AppSession()

  init() {
    #if DEBUG
    if ProcessInfo.processInfo.arguments.contains("--interaction-preview") {
      let previewSession = AppSession()
      previewSession.enterDemoMode()
      _session = State(initialValue: previewSession)
    }
    #endif
    URLCache.shared = URLCache(
      memoryCapacity: 50 * 1024 * 1024,
      diskCapacity: 300 * 1024 * 1024,
      diskPath: "BadmintonTrackerImages"
    )
  }

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(session)
    }
  }
}
