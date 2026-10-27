import SwiftUI
import SwiftData

@main
struct BadmintonTrackerApp: App {
  @State private var session = AppSession()

  init() {
    #if DEBUG
    if ProcessInfo.processInfo.arguments.contains("--interaction-sandbox"),
       let container = try? BadmintonDataContainer.inMemory() {
      // Exercise real mutations without touching the installed app's records.
      let legacyURL = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".json")
      let context = ModelContext(container)
      context.autosaveEnabled = false
      let store = LocalDataStore(context: context, legacyFileURL: legacyURL)
      _ = try? store.createPurchase(PurchaseInput(brandName: "RSL", modelCode: "1号", categoryName: "羽毛球",
        itemNameSnapshot: "亚狮龙 1 号", unitPriceCny: 145, quantity: 1,
        purchaseDate: "2026-08-06T00:00:00Z", channel: "线下门店", itemStatus: .inUse))
      // Allow time for inspection during manual Simulator QA; production uses 8 seconds.
      _session = State(initialValue: AppSession(repository: LocalEquipmentRepository(container: container, legacyFileURL: legacyURL),
        purchaseUndoDuration: .seconds(30)))
    } else if ProcessInfo.processInfo.arguments.contains("--interaction-preview") {
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
