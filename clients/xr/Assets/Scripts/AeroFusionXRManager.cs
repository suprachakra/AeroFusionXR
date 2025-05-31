/**
 * AeroFusionXR Unity XR Application Manager
 * ========================================
 * 
 * Enterprise-grade Unity XR application for immersive aviation experiences
 * supporting both AR and VR environments.
 * 
 * Features:
 * - 🥽 Cross-platform XR support (AR/VR/MR)
 * - 🛫 3D flight visualization and tracking
 * - 🗺️ Immersive airport navigation
 * - 🎯 Spatial mapping and anchoring
 * - 👋 Hand tracking and gesture recognition
 * - 👁️ Eye tracking and gaze interaction
 * - 🔊 Spatial audio and voice commands
 * - 📱 Mixed reality UI components
 * - 🤖 AI-powered virtual assistant
 * - 🧳 3D baggage tracking visualization
 * - 🛒 Virtual shopping experiences
 * - 📊 Real-time data visualization
 * - 🌐 Multi-user collaborative spaces
 * - ♿ Accessibility features for XR
 * 
 * Supported Platforms:
 * - Meta Quest 2/3/Pro
 * - HTC Vive/Vive Pro
 * - Varjo Aero/VR-3
 * - Microsoft HoloLens 2
 * - Magic Leap 2
 * - Apple Vision Pro (planned)
 * - Mobile AR (iOS/Android)
 * 
 * Architecture:
 * - Unity 2022.3 LTS with XR Toolkit
 * - OpenXR for cross-platform compatibility
 * - Universal Render Pipeline (URP)
 * - Addressable Asset System
 * - Unity Netcode for multiplayer
 * - REST API integration
 * - WebSocket real-time updates
 * 
 * Author: AeroFusionXR Team
 * License: Proprietary
 */

using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Management;
using UnityEngine.Networking;
using Unity.XR.CoreUtils;
using Unity.Netcode;
using TMPro;
using Newtonsoft.Json;

namespace AeroFusionXR.Core
{
    /// <summary>
    /// Main application manager for AeroFusionXR Unity XR experience
    /// </summary>
    public class AeroFusionXRManager : MonoBehaviour
    {
        [Header("XR Configuration")]
        [SerializeField] private XROrigin xrOrigin;
        [SerializeField] private XRInteractionManager interactionManager;
        [SerializeField] private bool enableHandTracking = true;
        [SerializeField] private bool enableEyeTracking = true;
        [SerializeField] private bool enableVoiceCommands = true;
        
        [Header("Network Configuration")]
        [SerializeField] private string apiBaseUrl = "https://api.aerofusionxr.com";
        [SerializeField] private string websocketUrl = "wss://ws.aerofusionxr.com";
        [SerializeField] private bool enableMultiplayer = true;
        
        [Header("Scene Management")]
        [SerializeField] private GameObject airportEnvironmentPrefab;
        [SerializeField] private GameObject flightVisualizationPrefab;
        [SerializeField] private GameObject wayfindingSystemPrefab;
        [SerializeField] private GameObject uiCanvasPrefab;
        
        [Header("Audio")]
        [SerializeField] private AudioSource ambientAudioSource;
        [SerializeField] private AudioSource voiceAudioSource;
        [SerializeField] private AudioClip[] notificationSounds;
        
        // Core managers
        private FlightTrackingManager flightManager;
        private WayfindingManager wayfindingManager;
        private BaggageTrackingManager baggageManager;
        private UIManager uiManager;
        private AudioManager audioManager;
        private NetworkManager networkManager;
        private HandTrackingManager handTrackingManager;
        private VoiceCommandManager voiceCommandManager;
        
        // XR state
        private bool isXRInitialized = false;
        private bool isHandTrackingActive = false;
        private bool isEyeTrackingActive = false;
        private XRDisplaySubsystem displaySubsystem;
        private XRInputSubsystem inputSubsystem;
        
        // Application state
        private ApplicationState currentState = ApplicationState.Initializing;
        private string currentUserId;
        private UserProfile userProfile;
        private List<ActiveSession> activeSessions = new List<ActiveSession>();
        
        // Events
        public static event Action<ApplicationState> OnApplicationStateChanged;
        public static event Action<XRDevice> OnXRDeviceChanged;
        public static event Action<string> OnUserAuthenticated;
        public static event Action<FlightData> OnFlightDataUpdated;
        
        public enum ApplicationState
        {
            Initializing,
            XRStarting,
            MenuScreen,
            FlightTracking,
            Navigation,
            BaggageTracking,
            Commerce,
            Settings,
            Error
        }
        
        public enum XRDevice
        {
            Unknown,
            MetaQuest,
            HTCVive,
            Varjo,
            HoloLens,
            MagicLeap,
            MobileAR
        }

        #region Unity Lifecycle
        
        private void Awake()
        {
            // Ensure singleton
            if (FindObjectsOfType<AeroFusionXRManager>().Length > 1)
            {
                Destroy(gameObject);
                return;
            }
            
            DontDestroyOnLoad(gameObject);
            
            // Initialize core systems
            InitializeCoreManagers();
        }
        
        private void Start()
        {
            StartCoroutine(InitializeApplication());
        }
        
        private void Update()
        {
            // Update XR tracking
            UpdateXRTracking();
            
            // Update hand tracking
            if (isHandTrackingActive)
            {
                handTrackingManager?.UpdateTracking();
            }
            
            // Check for voice commands
            if (enableVoiceCommands)
            {
                voiceCommandManager?.Update();
            }
            
            // Update network connections
            networkManager?.Update();
        }
        
        private void OnDestroy()
        {
            // Cleanup
            StopAllCoroutines();
            networkManager?.Disconnect();
            
            // Unregister events
            OnApplicationStateChanged = null;
            OnXRDeviceChanged = null;
            OnUserAuthenticated = null;
            OnFlightDataUpdated = null;
        }
        
        #endregion
        
        #region Initialization
        
        private void InitializeCoreManagers()
        {
            // Create manager instances
            flightManager = gameObject.AddComponent<FlightTrackingManager>();
            wayfindingManager = gameObject.AddComponent<WayfindingManager>();
            baggageManager = gameObject.AddComponent<BaggageTrackingManager>();
            uiManager = gameObject.AddComponent<UIManager>();
            audioManager = gameObject.AddComponent<AudioManager>();
            networkManager = gameObject.AddComponent<NetworkManager>();
            handTrackingManager = gameObject.AddComponent<HandTrackingManager>();
            voiceCommandManager = gameObject.AddComponent<VoiceCommandManager>();
            
            Debug.Log("[AeroFusionXR] Core managers initialized");
        }
        
        private IEnumerator InitializeApplication()
        {
            Debug.Log("[AeroFusionXR] Starting application initialization...");
            
            // Step 1: Initialize XR
            yield return StartCoroutine(InitializeXR());
            
            // Step 2: Setup networking
            yield return StartCoroutine(InitializeNetworking());
            
            // Step 3: Load user profile
            yield return StartCoroutine(LoadUserProfile());
            
            // Step 4: Initialize tracking systems
            yield return StartCoroutine(InitializeTrackingSystems());
            
            // Step 5: Setup UI
            yield return StartCoroutine(InitializeUI());
            
            // Step 6: Start main application
            SetApplicationState(ApplicationState.MenuScreen);
            
            Debug.Log("[AeroFusionXR] Application initialization complete!");
        }
        
        private IEnumerator InitializeXR()
        {
            Debug.Log("[AeroFusionXR] Initializing XR subsystems...");
            
            SetApplicationState(ApplicationState.XRStarting);
            
            // Initialize XR Loader
            yield return XRGeneralSettings.Instance.Manager.InitializeLoader();
            
            if (XRGeneralSettings.Instance.Manager.activeLoader == null)
            {
                Debug.LogError("[AeroFusionXR] Failed to initialize XR loader");
                SetApplicationState(ApplicationState.Error);
                yield break;
            }
            
            // Start XR subsystems
            XRGeneralSettings.Instance.Manager.StartSubsystems();
            
            // Get subsystems
            displaySubsystem = XRGeneralSettings.Instance.Manager.activeLoader.GetLoadedSubsystem<XRDisplaySubsystem>();
            inputSubsystem = XRGeneralSettings.Instance.Manager.activeLoader.GetLoadedSubsystem<XRInputSubsystem>();
            
            // Detect XR device
            DetectXRDevice();
            
            // Initialize hand tracking if supported
            if (enableHandTracking)
            {
                yield return StartCoroutine(InitializeHandTracking());
            }
            
            // Initialize eye tracking if supported
            if (enableEyeTracking)
            {
                yield return StartCoroutine(InitializeEyeTracking());
            }
            
            isXRInitialized = true;
            Debug.Log("[AeroFusionXR] XR initialization complete");
        }
        
        private IEnumerator InitializeNetworking()
        {
            Debug.Log("[AeroFusionXR] Initializing network connections...");
            
            // Initialize REST API client
            networkManager.InitializeRestClient(apiBaseUrl);
            
            // Initialize WebSocket connection
            yield return StartCoroutine(networkManager.ConnectWebSocket(websocketUrl));
            
            // Initialize multiplayer if enabled
            if (enableMultiplayer)
            {
                yield return StartCoroutine(InitializeMultiplayer());
            }
            
            Debug.Log("[AeroFusionXR] Network initialization complete");
        }
        
        private IEnumerator LoadUserProfile()
        {
            Debug.Log("[AeroFusionXR] Loading user profile...");
            
            // Load stored user credentials
            string storedUserId = PlayerPrefs.GetString("UserId", "");
            string storedToken = PlayerPrefs.GetString("AuthToken", "");
            
            if (!string.IsNullOrEmpty(storedUserId) && !string.IsNullOrEmpty(storedToken))
            {
                // Validate token and load profile
                yield return StartCoroutine(networkManager.ValidateUserToken(storedUserId, storedToken));
                
                if (networkManager.IsAuthenticated)
                {
                    currentUserId = storedUserId;
                    userProfile = networkManager.UserProfile;
                    OnUserAuthenticated?.Invoke(currentUserId);
                    Debug.Log($"[AeroFusionXR] User authenticated: {userProfile.Name}");
                }
                else
                {
                    Debug.Log("[AeroFusionXR] Token validation failed, guest mode enabled");
                    EnableGuestMode();
                }
            }
            else
            {
                Debug.Log("[AeroFusionXR] No stored credentials, guest mode enabled");
                EnableGuestMode();
            }
        }
        
        #endregion
        
        #region XR Management
        
        private void DetectXRDevice()
        {
            string deviceName = XRSettings.loadedDeviceName.ToLower();
            XRDevice detectedDevice = XRDevice.Unknown;
            
            if (deviceName.Contains("oculus") || deviceName.Contains("quest"))
            {
                detectedDevice = XRDevice.MetaQuest;
            }
            else if (deviceName.Contains("openvr") || deviceName.Contains("vive"))
            {
                detectedDevice = XRDevice.HTCVive;
            }
            else if (deviceName.Contains("varjo"))
            {
                detectedDevice = XRDevice.Varjo;
            }
            else if (deviceName.Contains("hololens"))
            {
                detectedDevice = XRDevice.HoloLens;
            }
            else if (deviceName.Contains("magicleap"))
            {
                detectedDevice = XRDevice.MagicLeap;
            }
            else if (Application.isMobilePlatform)
            {
                detectedDevice = XRDevice.MobileAR;
            }
            
            OnXRDeviceChanged?.Invoke(detectedDevice);
            Debug.Log($"[AeroFusionXR] Detected XR device: {detectedDevice}");
        }
        
        private IEnumerator InitializeHandTracking()
        {
            Debug.Log("[AeroFusionXR] Initializing hand tracking...");
            
            if (handTrackingManager.InitializeHandTracking())
            {
                isHandTrackingActive = true;
                Debug.Log("[AeroFusionXR] Hand tracking enabled");
            }
            else
            {
                Debug.LogWarning("[AeroFusionXR] Hand tracking not supported on this device");
            }
            
            yield return null;
        }
        
        private IEnumerator InitializeEyeTracking()
        {
            Debug.Log("[AeroFusionXR] Initializing eye tracking...");
            
            // Eye tracking implementation would depend on the specific XR platform
            // This is a placeholder for the actual implementation
            
            yield return new WaitForSeconds(1f);
            
            isEyeTrackingActive = false; // Set based on actual initialization
            Debug.Log($"[AeroFusionXR] Eye tracking: {(isEyeTrackingActive ? "enabled" : "not available")}");
        }
        
        private void UpdateXRTracking()
        {
            if (!isXRInitialized) return;
            
            // Update head tracking
            if (xrOrigin != null)
            {
                Transform headTransform = xrOrigin.Camera.transform;
                // Process head tracking data
            }
            
            // Update controller tracking
            var leftController = InputDevices.GetDeviceAtXRNode(XRNode.LeftHand);
            var rightController = InputDevices.GetDeviceAtXRNode(XRNode.RightHand);
            
            // Process controller input
            ProcessControllerInput(leftController, rightController);
        }
        
        private void ProcessControllerInput(InputDevice leftController, InputDevice rightController)
        {
            // Process trigger buttons
            if (leftController.TryGetFeatureValue(CommonUsages.triggerButton, out bool leftTrigger) && leftTrigger)
            {
                HandleControllerTrigger(XRNode.LeftHand);
            }
            
            if (rightController.TryGetFeatureValue(CommonUsages.triggerButton, out bool rightTrigger) && rightTrigger)
            {
                HandleControllerTrigger(XRNode.RightHand);
            }
            
            // Process grip buttons
            if (leftController.TryGetFeatureValue(CommonUsages.gripButton, out bool leftGrip) && leftGrip)
            {
                HandleControllerGrip(XRNode.LeftHand);
            }
            
            if (rightController.TryGetFeatureValue(CommonUsages.gripButton, out bool rightGrip) && rightGrip)
            {
                HandleControllerGrip(XRNode.RightHand);
            }
            
            // Process thumbstick input
            if (leftController.TryGetFeatureValue(CommonUsages.primary2DAxis, out Vector2 leftThumbstick))
            {
                HandleThumbstickInput(XRNode.LeftHand, leftThumbstick);
            }
            
            if (rightController.TryGetFeatureValue(CommonUsages.primary2DAxis, out Vector2 rightThumbstick))
            {
                HandleThumbstickInput(XRNode.RightHand, rightThumbstick);
            }
        }
        
        #endregion
        
        #region Application State Management
        
        private void SetApplicationState(ApplicationState newState)
        {
            if (currentState == newState) return;
            
            Debug.Log($"[AeroFusionXR] State change: {currentState} -> {newState}");
            
            // Handle state exit
            HandleStateExit(currentState);
            
            // Update state
            currentState = newState;
            
            // Handle state enter
            HandleStateEnter(newState);
            
            // Notify listeners
            OnApplicationStateChanged?.Invoke(newState);
        }
        
        private void HandleStateExit(ApplicationState state)
        {
            switch (state)
            {
                case ApplicationState.FlightTracking:
                    flightManager?.StopTracking();
                    break;
                case ApplicationState.Navigation:
                    wayfindingManager?.StopNavigation();
                    break;
                case ApplicationState.BaggageTracking:
                    baggageManager?.StopTracking();
                    break;
            }
        }
        
        private void HandleStateEnter(ApplicationState state)
        {
            switch (state)
            {
                case ApplicationState.MenuScreen:
                    uiManager?.ShowMainMenu();
                    break;
                case ApplicationState.FlightTracking:
                    StartFlightTracking();
                    break;
                case ApplicationState.Navigation:
                    StartNavigation();
                    break;
                case ApplicationState.BaggageTracking:
                    StartBaggageTracking();
                    break;
                case ApplicationState.Commerce:
                    StartCommerceExperience();
                    break;
                case ApplicationState.Error:
                    uiManager?.ShowErrorScreen();
                    break;
            }
        }
        
        #endregion
        
        #region Feature Implementations
        
        private void StartFlightTracking()
        {
            Debug.Log("[AeroFusionXR] Starting flight tracking experience...");
            
            // Load flight visualization environment
            if (flightVisualizationPrefab != null)
            {
                GameObject flightViz = Instantiate(flightVisualizationPrefab);
                flightManager.InitializeVisualization(flightViz);
            }
            
            // Start tracking user's flights
            flightManager.StartTracking(currentUserId);
            
            // Update UI
            uiManager?.ShowFlightTrackingUI();
        }
        
        private void StartNavigation()
        {
            Debug.Log("[AeroFusionXR] Starting navigation experience...");
            
            // Load wayfinding system
            if (wayfindingSystemPrefab != null)
            {
                GameObject wayfinding = Instantiate(wayfindingSystemPrefab);
                wayfindingManager.InitializeWayfinding(wayfinding);
            }
            
            // Start navigation
            wayfindingManager.StartNavigation();
            
            // Update UI
            uiManager?.ShowNavigationUI();
        }
        
        private void StartBaggageTracking()
        {
            Debug.Log("[AeroFusionXR] Starting baggage tracking experience...");
            
            // Initialize baggage tracking
            baggageManager.StartTracking(currentUserId);
            
            // Update UI
            uiManager?.ShowBaggageTrackingUI();
        }
        
        private void StartCommerceExperience()
        {
            Debug.Log("[AeroFusionXR] Starting commerce experience...");
            
            // Load virtual shopping environment
            // Implementation would load 3D store models and product catalogs
            
            // Update UI
            uiManager?.ShowCommerceUI();
        }
        
        #endregion
        
        #region Input Handlers
        
        private void HandleControllerTrigger(XRNode hand)
        {
            Debug.Log($"[AeroFusionXR] Controller trigger pressed: {hand}");
            
            switch (currentState)
            {
                case ApplicationState.MenuScreen:
                    uiManager?.HandleMenuSelection(hand);
                    break;
                case ApplicationState.FlightTracking:
                    flightManager?.HandleInteraction(hand);
                    break;
                case ApplicationState.Navigation:
                    wayfindingManager?.HandleInteraction(hand);
                    break;
                case ApplicationState.BaggageTracking:
                    baggageManager?.HandleInteraction(hand);
                    break;
            }
        }
        
        private void HandleControllerGrip(XRNode hand)
        {
            Debug.Log($"[AeroFusionXR] Controller grip pressed: {hand}");
            
            // Handle grip-specific interactions
            if (currentState == ApplicationState.Navigation)
            {
                wayfindingManager?.HandleGripInteraction(hand);
            }
        }
        
        private void HandleThumbstickInput(XRNode hand, Vector2 input)
        {
            // Handle thumbstick movement
            if (input.magnitude > 0.5f)
            {
                switch (currentState)
                {
                    case ApplicationState.Navigation:
                        wayfindingManager?.HandleMovementInput(hand, input);
                        break;
                    case ApplicationState.FlightTracking:
                        flightManager?.HandleNavigationInput(hand, input);
                        break;
                }
            }
        }
        
        #endregion
        
        #region Utility Methods
        
        private void EnableGuestMode()
        {
            currentUserId = "guest_" + Guid.NewGuid().ToString("N")[..8];
            userProfile = new UserProfile
            {
                Id = currentUserId,
                Name = "Guest User",
                IsGuest = true
            };
            
            Debug.Log("[AeroFusionXR] Guest mode enabled");
        }
        
        private IEnumerator InitializeMultiplayer()
        {
            Debug.Log("[AeroFusionXR] Initializing multiplayer...");
            
            // Initialize Unity Netcode
            var netcodeManager = GetComponent<Unity.Netcode.NetworkManager>();
            if (netcodeManager != null)
            {
                // Configure multiplayer settings
                netcodeManager.StartHost();
            }
            
            yield return new WaitForSeconds(2f);
            
            Debug.Log("[AeroFusionXR] Multiplayer initialization complete");
        }
        
        #endregion
        
        #region Public API
        
        public void NavigateToState(ApplicationState state)
        {
            SetApplicationState(state);
        }
        
        public void AuthenticateUser(string userId, string token)
        {
            StartCoroutine(networkManager.AuthenticateUser(userId, token));
        }
        
        public void LogoutUser()
        {
            PlayerPrefs.DeleteKey("UserId");
            PlayerPrefs.DeleteKey("AuthToken");
            PlayerPrefs.Save();
            
            currentUserId = null;
            userProfile = null;
            
            EnableGuestMode();
        }
        
        public bool IsFeatureAvailable(string featureName)
        {
            switch (featureName.ToLower())
            {
                case "handtracking":
                    return isHandTrackingActive;
                case "eyetracking":
                    return isEyeTrackingActive;
                case "voicecommands":
                    return enableVoiceCommands;
                case "multiplayer":
                    return enableMultiplayer;
                default:
                    return false;
            }
        }
        
        public void RecenterTracking()
        {
            if (xrOrigin != null)
            {
                xrOrigin.MoveCameraToWorldLocation(Vector3.zero);
                xrOrigin.MatchOriginUpCameraForward(Vector3.up, Vector3.forward);
            }
        }
        
        #endregion
    }
    
    // ================================
    // SUPPORTING DATA STRUCTURES
    // ================================
    
    [Serializable]
    public class UserProfile
    {
        public string Id;
        public string Name;
        public string Email;
        public bool IsGuest;
        public Dictionary<string, object> Preferences;
        public List<string> RecentFlights;
    }
    
    [Serializable]
    public class ActiveSession
    {
        public string SessionId;
        public string UserId;
        public DateTime StartTime;
        public ApplicationState CurrentState;
        public Dictionary<string, object> SessionData;
    }
    
    [Serializable]
    public class FlightData
    {
        public string FlightNumber;
        public string Airline;
        public string Origin;
        public string Destination;
        public DateTime ScheduledDeparture;
        public DateTime ScheduledArrival;
        public string Status;
        public Vector3 CurrentPosition;
        public float Altitude;
        public float Speed;
    }
} 