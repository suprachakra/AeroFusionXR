import UIKit
import React
import CoreData
import UserNotifications
import CoreLocation
import LocalAuthentication
import AVFoundation
import CoreMotion
import CoreBluetooth
import Network
import BackgroundTasks
import Intents
import IntentsUI
import CallKit
import PushKit
import MapKit
import StoreKit
import SafariServices
import MessageUI
import ContactsUI
import EventKit
import EventKitUI
import Photos
import PhotosUI
import Vision
import VisionKit
import NaturalLanguage
import Speech
import SoundAnalysis
import CoreML
import CreateML
import GameplayKit
import SceneKit
import RealityKit
import ARKit

// Firebase
import Firebase
import FirebaseCore
import FirebaseMessaging
import FirebaseAnalytics
import FirebaseCrashlytics
import FirebasePerformance
import FirebaseDynamicLinks
import FirebaseRemoteConfig

// Security & Keychain
import Security
import CryptoKit
import CommonCrypto

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, CBCentralManagerDelegate, CLLocationManagerDelegate, LAContextDelegate, ARSessionDelegate {

    var window: UIWindow?
    var bridge: RCTBridge!
    
    // Core Services
    private var locationManager: CLLocationManager!
    private var motionManager: CMMotionManager!
    private var bluetoothManager: CBCentralManager!
    private var networkMonitor: NWPathMonitor!
    private var audioSession: AVAudioSession!
    private var speechRecognizer: SFSpeechRecognizer!
    private var arSession: ARSession!
    
    // Security & Authentication
    private var laContext: LAContext!
    private var keychain: SecKeychain!
    
    // Background Tasks
    private var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid
    private let backgroundQueue = DispatchQueue(label: "com.aerofusionxr.background", qos: .background)
    
    // Notification Categories
    private let flightUpdateCategory = "FLIGHT_UPDATE"
    private let baggageAlertCategory = "BAGGAGE_ALERT"
    private let gateChangeCategory = "GATE_CHANGE"
    private let boardingCategory = "BOARDING_ALERT"
    
    // MARK: - Application Lifecycle
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Initialize Firebase
        initializeFirebase()
        
        // Initialize Core Services
        initializeCoreServices()
        
        // Setup Security
        setupSecurity()
        
        // Setup Notifications
        setupNotifications()
        
        // Setup Background Tasks
        setupBackgroundTasks()
        
        // Initialize AR
        initializeAR()
        
        // Setup React Native Bridge
        setupReactNativeBridge()
        
        // Request Permissions
        requestPermissions()
        
        // Setup App Shortcuts
        setupAppShortcuts()
        
        return true
    }
    
    // MARK: - Firebase Initialization
    
    private func initializeFirebase() {
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let plist = NSDictionary(contentsOfFile: path) else {
            print("❌ GoogleService-Info.plist not found")
            return
        }
        
        FirebaseApp.configure()
        
        // Initialize Analytics
        Analytics.setAnalyticsCollectionEnabled(true)
        
        // Initialize Performance Monitoring
        Performance.startConfiguration()
        
        // Initialize Crashlytics
        Crashlytics.crashlytics().setCrashlyticsCollectionEnabled(true)
        
        // Initialize Remote Config
        setupRemoteConfig()
        
        print("✅ Firebase initialized successfully")
    }
    
    private func setupRemoteConfig() {
        let remoteConfig = RemoteConfig.remoteConfig()
        let settings = RemoteConfigSettings()
        settings.minimumFetchInterval = 0 // For development
        remoteConfig.configSettings = settings
        
        // Set default values
        remoteConfig.setDefaults([
            "feature_ar_enabled": true,
            "feature_voice_commands": true,
            "api_timeout_seconds": 30,
            "max_concurrent_requests": 10
        ])
        
        remoteConfig.fetch { [weak self] status, error in
            if status == .success {
                remoteConfig.activate()
                print("✅ Remote Config fetched successfully")
            } else if let error = error {
                print("❌ Remote Config fetch failed: \(error)")
            }
        }
    }
    
    // MARK: - Core Services Initialization
    
    private func initializeCoreServices() {
        // Location Manager
        locationManager = CLLocationManager()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 1.0
        
        // Motion Manager
        motionManager = CMMotionManager()
        motionManager.accelerometerUpdateInterval = 1.0/60.0
        motionManager.gyroUpdateInterval = 1.0/60.0
        motionManager.magnetometerUpdateInterval = 1.0/60.0
        motionManager.deviceMotionUpdateInterval = 1.0/60.0
        
        // Bluetooth Manager
        bluetoothManager = CBCentralManager(delegate: self, queue: nil)
        
        // Network Monitor
        networkMonitor = NWPathMonitor()
        networkMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.handleNetworkStatusChange(path: path)
            }
        }
        networkMonitor.start(queue: backgroundQueue)
        
        // Audio Session
        audioSession = AVAudioSession.sharedInstance()
        try? audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
        
        // Speech Recognizer
        speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
        
        print("✅ Core services initialized")
    }
    
    // MARK: - Security Setup
    
    private func setupSecurity() {
        laContext = LAContext()
        
        // Check biometric authentication availability
        var error: NSError?
        guard laContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            print("⚠️ Biometric authentication not available: \(error?.localizedDescription ?? "Unknown error")")
            return
        }
        
        // Setup app protection
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillResignActive),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        
        print("✅ Security configured")
    }
    
    // MARK: - Notifications Setup
    
    private func setupNotifications() {
        UNUserNotificationCenter.current().delegate = self
        
        // Define notification categories
        let flightUpdateCategory = UNNotificationCategory(
            identifier: flightUpdateCategory,
            actions: [
                UNNotificationAction(identifier: "VIEW_FLIGHT", title: "View Flight", options: .foreground),
                UNNotificationAction(identifier: "DISMISS", title: "Dismiss", options: [])
            ],
            intentIdentifiers: [],
            options: []
        )
        
        let baggageAlertCategory = UNNotificationCategory(
            identifier: baggageAlertCategory,
            actions: [
                UNNotificationAction(identifier: "TRACK_BAGGAGE", title: "Track Baggage", options: .foreground),
                UNNotificationAction(identifier: "DISMISS", title: "Dismiss", options: [])
            ],
            intentIdentifiers: [],
            options: []
        )
        
        let gateChangeCategory = UNNotificationCategory(
            identifier: gateChangeCategory,
            actions: [
                UNNotificationAction(identifier: "NAVIGATE_TO_GATE", title: "Navigate", options: .foreground),
                UNNotificationAction(identifier: "VIEW_DETAILS", title: "View Details", options: .foreground)
            ],
            intentIdentifiers: [],
            options: []
        )
        
        let boardingCategory = UNNotificationCategory(
            identifier: boardingCategory,
            actions: [
                UNNotificationAction(identifier: "SHOW_BOARDING_PASS", title: "Show Boarding Pass", options: .foreground),
                UNNotificationAction(identifier: "NAVIGATE_TO_GATE", title: "Navigate to Gate", options: .foreground)
            ],
            intentIdentifiers: [],
            options: []
        )
        
        UNUserNotificationCenter.current().setNotificationCategories([
            flightUpdateCategory, baggageAlertCategory, gateChangeCategory, boardingCategory
        ])
        
        // Configure Messaging
        Messaging.messaging().delegate = self
        
        print("✅ Notifications configured")
    }
    
    // MARK: - Background Tasks Setup
    
    private func setupBackgroundTasks() {
        // Register background tasks
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.aerofusionxr.refresh",
            using: nil
        ) { task in
            self.handleAppRefresh(task: task as! BGAppRefreshTask)
        }
        
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.aerofusionxr.processing",
            using: nil
        ) { task in
            self.handleBackgroundProcessing(task: task as! BGProcessingTask)
        }
        
        print("✅ Background tasks registered")
    }
    
    // MARK: - AR Initialization
    
    private func initializeAR() {
        guard ARWorldTrackingConfiguration.isSupported else {
            print("⚠️ AR World Tracking not supported on this device")
            return
        }
        
        arSession = ARSession()
        arSession.delegate = self
        
        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]
        configuration.environmentTexturing = .automatic
        
        if ARWorldTrackingConfiguration.supportsUserFaceTracking {
            configuration.userFaceTrackingEnabled = true
        }
        
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            configuration.sceneReconstruction = .mesh
        }
        
        arSession.run(configuration)
        
        print("✅ AR Session initialized")
    }
    
    // MARK: - React Native Bridge Setup
    
    private func setupReactNativeBridge() {
        let jsCodeLocation = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
        
        bridge = RCTBridge(bundleURL: jsCodeLocation, moduleProvider: nil, launchOptions: nil)
        
        let rootView = RCTRootView(bridge: bridge, moduleName: "AeroFusionXR", initialProperties: nil)
        rootView.backgroundColor = UIColor.systemBackground
        
        window = UIWindow(frame: UIScreen.main.bounds)
        let rootViewController = UIViewController()
        rootViewController.view = rootView
        window?.rootViewController = rootViewController
        window?.makeKeyAndVisible()
        
        print("✅ React Native bridge configured")
    }
    
    // MARK: - Permissions
    
    private func requestPermissions() {
        // Location permissions
        locationManager.requestWhenInUseAuthorization()
        
        // Notification permissions
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound, .provisional]) { granted, error in
            if granted {
                print("✅ Notification permission granted")
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            } else {
                print("❌ Notification permission denied: \(error?.localizedDescription ?? "Unknown error")")
            }
        }
        
        // Camera permissions
        AVCaptureDevice.requestAccess(for: .video) { granted in
            print("📸 Camera permission: \(granted ? "granted" : "denied")")
        }
        
        // Microphone permissions
        AVCaptureDevice.requestAccess(for: .audio) { granted in
            print("🎤 Microphone permission: \(granted ? "granted" : "denied")")
        }
        
        // Speech recognition permissions
        SFSpeechRecognizer.requestAuthorization { status in
            print("🗣️ Speech recognition permission: \(status)")
        }
        
        // Motion permissions
        if motionManager.isDeviceMotionAvailable {
            motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, error in
                guard let motion = motion else { return }
                self?.handleMotionUpdate(motion: motion)
            }
        }
    }
    
    // MARK: - App Shortcuts
    
    private func setupAppShortcuts() {
        let shortcuts = [
            UIApplicationShortcutItem(
                type: "com.aerofusionxr.scan",
                localizedTitle: "Scan QR Code",
                localizedSubtitle: "Quick boarding pass scan",
                icon: UIApplicationShortcutIcon(type: .capturePhoto)
            ),
            UIApplicationShortcutItem(
                type: "com.aerofusionxr.flights",
                localizedTitle: "My Flights",
                localizedSubtitle: "View upcoming flights",
                icon: UIApplicationShortcutIcon(type: .time)
            ),
            UIApplicationShortcutItem(
                type: "com.aerofusionxr.navigate",
                localizedTitle: "AR Navigation",
                localizedSubtitle: "Navigate to gate",
                icon: UIApplicationShortcutIcon(type: .location)
            ),
            UIApplicationShortcutItem(
                type: "com.aerofusionxr.baggage",
                localizedTitle: "Track Baggage",
                localizedSubtitle: "Find your luggage",
                icon: UIApplicationShortcutIcon(type: .search)
            )
        ]
        
        UIApplication.shared.shortcutItems = shortcuts
    }
    
    // MARK: - Event Handlers
    
    @objc private func appWillResignActive() {
        // Blur screen for privacy
        addPrivacyBlur()
        
        // Pause AR session
        arSession?.pause()
        
        // Schedule background tasks
        scheduleBackgroundTasks()
    }
    
    @objc private func appDidBecomeActive() {
        // Remove privacy blur
        removePrivacyBlur()
        
        // Resume AR session
        if let configuration = arSession?.configuration {
            arSession?.run(configuration)
        }
        
        // Refresh data
        refreshApplicationData()
    }
    
    private func addPrivacyBlur() {
        let blurEffect = UIBlurEffect(style: .systemThickMaterial)
        let blurView = UIVisualEffectView(effect: blurEffect)
        blurView.frame = window?.bounds ?? .zero
        blurView.tag = 999
        window?.addSubview(blurView)
    }
    
    private func removePrivacyBlur() {
        window?.viewWithTag(999)?.removeFromSuperview()
    }
    
    private func scheduleBackgroundTasks() {
        let request = BGAppRefreshTaskRequest(identifier: "com.aerofusionxr.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("❌ Could not schedule app refresh: \(error)")
        }
    }
    
    private func refreshApplicationData() {
        // Refresh flight data, baggage status, etc.
        bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["refreshData", [:]], completion: nil)
    }
    
    // MARK: - Background Task Handlers
    
    private func handleAppRefresh(task: BGAppRefreshTask) {
        scheduleBackgroundTasks()
        
        let operation = BlockOperation {
            // Perform data refresh
            // This would typically involve API calls to update flight status, baggage location, etc.
        }
        
        task.expirationHandler = {
            operation.cancel()
        }
        
        operation.completionBlock = {
            task.setTaskCompleted(success: !operation.isCancelled)
        }
        
        OperationQueue().addOperation(operation)
    }
    
    private func handleBackgroundProcessing(task: BGProcessingTask) {
        let operation = BlockOperation {
            // Perform heavy background processing
            // Data synchronization, cache cleanup, etc.
        }
        
        task.expirationHandler = {
            operation.cancel()
        }
        
        operation.completionBlock = {
            task.setTaskCompleted(success: !operation.isCancelled)
        }
        
        OperationQueue().addOperation(operation)
    }
    
    // MARK: - Motion Updates
    
    private func handleMotionUpdate(motion: CMDeviceMotion) {
        let accelerationData = [
            "x": motion.userAcceleration.x,
            "y": motion.userAcceleration.y,
            "z": motion.userAcceleration.z
        ]
        
        let rotationData = [
            "x": motion.rotationRate.x,
            "y": motion.rotationRate.y,
            "z": motion.rotationRate.z
        ]
        
        let motionData = [
            "acceleration": accelerationData,
            "rotation": rotationData,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        // Send to React Native
        bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["motionData", motionData], completion: nil)
    }
    
    // MARK: - Network Status
    
    private func handleNetworkStatusChange(path: NWPath) {
        let networkStatus = [
            "isConnected": path.status == .satisfied,
            "isExpensive": path.isExpensive,
            "isConstrained": path.isConstrained,
            "connectionType": getConnectionType(path: path)
        ]
        
        bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["networkStatus", networkStatus], completion: nil)
    }
    
    private func getConnectionType(path: NWPath) -> String {
        if path.usesInterfaceType(.wifi) {
            return "wifi"
        } else if path.usesInterfaceType(.cellular) {
            return "cellular"
        } else if path.usesInterfaceType(.wiredEthernet) {
            return "ethernet"
        } else {
            return "unknown"
        }
    }
    
    // MARK: - Biometric Authentication
    
    func authenticateWithBiometrics(completion: @escaping (Bool, Error?) -> Void) {
        let reason = "Authenticate to access AeroFusionXR"
        
        laContext.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
            DispatchQueue.main.async {
                completion(success, error)
            }
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension AppDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.alert, .badge, .sound])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        
        switch response.actionIdentifier {
        case "VIEW_FLIGHT":
            // Navigate to flight details
            bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["navigateToFlightDetails", userInfo], completion: nil)
        case "TRACK_BAGGAGE":
            // Navigate to baggage tracking
            bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["navigateToBaggageTracking", userInfo], completion: nil)
        case "NAVIGATE_TO_GATE":
            // Start AR navigation
            bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["startARNavigation", userInfo], completion: nil)
        case "SHOW_BOARDING_PASS":
            // Show boarding pass
            bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["showBoardingPass", userInfo], completion: nil)
        default:
            break
        }
        
        completionHandler()
    }
}

// MARK: - MessagingDelegate

extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("✅ FCM registration token: \(fcmToken ?? "nil")")
        
        if let token = fcmToken {
            // Send token to React Native
            bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["fcmTokenReceived", token], completion: nil)
        }
    }
}

// MARK: - Remote Notifications

extension AppDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        print("✅ Device Token: \(token)")
        
        // Set APNS token for Firebase
        Messaging.messaging().apnsToken = deviceToken
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("❌ Failed to register for remote notifications: \(error)")
    }
    
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        // Handle background notification
        print("📱 Received remote notification: \(userInfo)")
        
        // Process notification data
        bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["remoteNotificationReceived", userInfo], completion: nil)
        
        completionHandler(.newData)
    }
}

// MARK: - Location Manager Delegate

extension AppDelegate: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        let locationData = [
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "altitude": location.altitude,
            "accuracy": location.horizontalAccuracy,
            "timestamp": location.timestamp.timeIntervalSince1970
        ]
        
        bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["locationUpdate", locationData], completion: nil)
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("❌ Location manager failed: \(error)")
    }
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.startUpdatingLocation()
        case .denied, .restricted:
            print("⚠️ Location access denied")
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        @unknown default:
            break
        }
    }
}

// MARK: - Bluetooth Manager Delegate

extension AppDelegate: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        let bluetoothStatus: String
        
        switch central.state {
        case .poweredOn:
            bluetoothStatus = "poweredOn"
        case .poweredOff:
            bluetoothStatus = "poweredOff"
        case .unauthorized:
            bluetoothStatus = "unauthorized"
        case .unsupported:
            bluetoothStatus = "unsupported"
        case .resetting:
            bluetoothStatus = "resetting"
        case .unknown:
            bluetoothStatus = "unknown"
        @unknown default:
            bluetoothStatus = "unknown"
        }
        
        bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["bluetoothStatusChanged", bluetoothStatus], completion: nil)
    }
}

// MARK: - AR Session Delegate

extension AppDelegate: ARSessionDelegate {
    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        // Handle AR frame updates if needed
        // This would typically be handled by the AR module
    }
    
    func session(_ session: ARSession, didAdd anchors: [ARAnchor]) {
        // Handle new anchors
        let anchorData = anchors.map { anchor in
            [
                "identifier": anchor.identifier.uuidString,
                "transform": NSStringFromCGAffineTransform(CGAffineTransform(anchor.transform))
            ]
        }
        
        bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["arAnchorsAdded", anchorData], completion: nil)
    }
    
    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        // Handle anchor updates
    }
    
    func session(_ session: ARSession, didRemove anchors: [ARAnchor]) {
        // Handle anchor removal
        let anchorIds = anchors.map { $0.identifier.uuidString }
        bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["arAnchorsRemoved", anchorIds], completion: nil)
    }
    
    func session(_ session: ARSession, didFailWithError error: Error) {
        print("❌ AR Session failed: \(error)")
        bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["arSessionError", error.localizedDescription], completion: nil)
    }
}

// MARK: - Application Shortcuts

extension AppDelegate {
    func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        switch shortcutItem.type {
        case "com.aerofusionxr.scan":
            bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["shortcutAction", "scan"], completion: nil)
        case "com.aerofusionxr.flights":
            bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["shortcutAction", "flights"], completion: nil)
        case "com.aerofusionxr.navigate":
            bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["shortcutAction", "navigate"], completion: nil)
        case "com.aerofusionxr.baggage":
            bridge.enqueueJSCall("RNEventEmitter", method: "emit", args: ["shortcutAction", "baggage"], completion: nil)
        default:
            completionHandler(false)
            return
        }
        
        completionHandler(true)
    }
} 