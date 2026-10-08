import Foundation

enum PreviewData {
  static let brandYonex = NamedRef(id: "brand-yonex", name: "YONEX")
  static let brandVictor = NamedRef(id: "brand-victor", name: "VICTOR")
  static let categoryRacket = NamedRef(id: "category-racket", name: "球拍")
  static let categoryShuttle = NamedRef(id: "category-shuttle", name: "羽毛球")

  static let purchases: [PurchaseRecord] = [
    PurchaseRecord(
      id: "purchase-1",
      itemNameSnapshot: "YONEX ASTROX 88D Pro",
      unitPriceCny: 1280,
      quantity: 1,
      totalPriceCny: 1280,
      itemStatus: .inUse,
      purchaseDate: "2026-05-10T08:00:00.000Z",
      channel: "线下门店",
      notes: "主力进攻拍",
      brand: brandYonex,
      category: categoryRacket,
      gearItem: GearSummary(
        id: "gear-1",
        modelCode: "88D Pro",
        coverImageUrl: nil,
        imageKey: "yonex_racket_arcsaber11pro_main_01",
        profileDetails: .racket(RacketGearDetails(
          weightSpec: "4U",
          gripSpec: "G5",
          currentString: "BG80",
          mainTension: 27,
          crossTension: 25,
          stringingDate: "2026-05-12T08:00:00.000Z",
          stringHistory: []
        ))
      )
    ),
    PurchaseRecord(
      id: "purchase-2",
      itemNameSnapshot: "VICTOR MASTER ACE",
      unitPriceCny: 98,
      quantity: 3,
      totalPriceCny: 294,
      itemStatus: .stored,
      purchaseDate: "2026-04-21T08:00:00.000Z",
      channel: "电商",
      notes: nil,
      brand: brandVictor,
      category: categoryShuttle,
      gearItem: GearSummary(
        id: "gear-2",
        modelCode: nil,
        coverImageUrl: nil,
        imageKey: "rsl_shuttlecock_no1_cutout_01",
        profileDetails: .shuttle(ShuttleGearDetails(ballsPerTube: 12, speed: "77"))
      )
    )
  ]

  static let gearItems: [GearItem] = [
    GearItem(
      id: "gear-1",
      name: "YONEX ASTROX 88D Pro",
      modelCode: "88D Pro",
      coverImageUrl: nil,
      imageKey: "yonex_racket_arcsaber11pro_main_01",
      notes: "后场进攻取向",
      brand: brandYonex,
      category: categoryRacket,
      ratings: [GearRating(overall: 9.1)]
    ),
    GearItem(
      id: "gear-2",
      name: "VICTOR MASTER ACE",
      modelCode: nil,
      coverImageUrl: nil,
      imageKey: "rsl_shuttlecock_no1_cutout_01",
      notes: "训练用球",
      brand: brandVictor,
      category: categoryShuttle,
      ratings: [GearRating(overall: 8.4)]
    )
  ]

  static let gearWallItems: [GearWallItem] = [
    GearWallItem(
      id: "gear-1",
      name: "YONEX ASTROX 88D Pro",
      coverImageUrl: nil,
      imageKey: "yonex_racket_arcsaber11pro_main_01",
      modelCode: "88D Pro",
      createdAt: "2026-05-10T08:00:00.000Z",
      latestPurchaseDate: "2026-05-10T08:00:00.000Z",
      referenceUnitPriceCny: 1280,
      brand: brandYonex,
      category: categoryRacket,
      profileDetails: .racket(RacketGearDetails(
        weightSpec: "4U",
        gripSpec: "G5",
        currentString: "BG80",
        mainTension: 27,
        crossTension: 25,
        stringingDate: "2026-05-12T08:00:00.000Z",
        stringHistory: []
      )),
      ratings: [GearRating(overall: 9.1)],
      totalQuantity: 1,
      activeQuantity: 1,
      usedUpQuantity: 0,
      wornOutQuantity: 0
    ),
    GearWallItem(
      id: "gear-2",
      name: "VICTOR MASTER ACE",
      coverImageUrl: nil,
      imageKey: "rsl_shuttlecock_no1_cutout_01",
      modelCode: nil,
      createdAt: "2026-04-21T08:00:00.000Z",
      latestPurchaseDate: "2026-04-21T08:00:00.000Z",
      referenceUnitPriceCny: 98,
      brand: brandVictor,
      category: categoryShuttle,
      profileDetails: .shuttle(ShuttleGearDetails(ballsPerTube: 12, speed: "77")),
      ratings: [GearRating(overall: 8.4)],
      totalQuantity: 3,
      activeQuantity: 3,
      usedUpQuantity: 0,
      wornOutQuantity: 0
    )
  ]

  static let wishlistItems: [WishlistItem] = [
    WishlistItem(
      id: "wish-1",
      name: "YONEX NANOFLARE 1000Z",
      targetPriceCny: 1180,
      currentSeenPriceCny: 1299,
      priority: 2,
      status: .watching,
      sourceUrl: nil,
      imageUrl: nil,
      notes: "等活动价",
      brand: brandYonex,
      category: categoryRacket
    )
  ]

  static let analytics = AnalyticsData(
    range: "all",
    availableYears: [2026],
    trend: [
      TrendPoint(bucket: "3月", amount: 520),
      TrendPoint(bucket: "4月", amount: 294),
      TrendPoint(bucket: "5月", amount: 1280)
    ],
    brandShare: [
      BrandShare(brand: "YONEX", amount: 1280),
      BrandShare(brand: "VICTOR", amount: 294)
    ],
    categoryShare: [
      CategoryShare(category: "球拍", amount: 1280),
      CategoryShare(category: "羽毛球", amount: 294)
    ],
    frequency: [
      FrequencyPoint(bucket: "5月", count: 2)
    ],
    wishlistCounts: [
      WishlistCount(status: .watching, count: 1)
    ],
    gearRanking: [
      GearRank(id: "gear-1", name: "YONEX ASTROX 88D Pro", overall: 9.1),
      GearRank(id: "gear-2", name: "VICTOR MASTER ACE", overall: 8.4)
    ]
  )
}
