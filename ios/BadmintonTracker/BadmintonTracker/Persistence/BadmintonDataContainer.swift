import Foundation
import SwiftData

enum BadmintonDataContainer {
  static let shared: ModelContainer = {
    do {
      let supportURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appending(path: "BadmintonTracker", directoryHint: .isDirectory)
      try FileManager.default.createDirectory(at: supportURL, withIntermediateDirectories: true)
      let schema = Schema(versionedSchema: BadmintonTrackerSchemaV1.self)
      let configuration = ModelConfiguration(
        "BadmintonTracker",
        schema: schema,
        url: supportURL.appending(path: "BadmintonTracker.store"),
        cloudKitDatabase: .none
      )
      return try ModelContainer(
        for: schema,
        migrationPlan: BadmintonTrackerMigrationPlan.self,
        configurations: configuration
      )
    } catch {
      fatalError("Unable to create the local SwiftData store: \(error.localizedDescription)")
    }
  }()

  static func inMemory() throws -> ModelContainer {
    let schema = Schema(versionedSchema: BadmintonTrackerSchemaV1.self)
    let configuration = ModelConfiguration(
      "BadmintonTrackerTests",
      schema: schema,
      isStoredInMemoryOnly: true,
      cloudKitDatabase: .none
    )
    return try ModelContainer(
      for: schema,
      migrationPlan: BadmintonTrackerMigrationPlan.self,
      configurations: configuration
    )
  }
}
