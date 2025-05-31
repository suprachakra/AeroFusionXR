using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using UnityEngine.UI;
using TMPro;
using Newtonsoft.Json;
using System.Net.Http;
using System.Threading.Tasks;

namespace AeroFusionXR
{
    /// <summary>
    /// Main manager for AeroFusionXR application
    /// Handles AR functionality, UI management, and backend integration
    /// </summary>
    public class AeroFusionXRManager : MonoBehaviour
    {
        [Header("AR Components")]
        [SerializeField] private ARCamera arCamera;
        [SerializeField] private ARSessionOrigin arSessionOrigin;
        [SerializeField] private ARSession arSession;
        [SerializeField] private ARPlaneManager planeManager;
        [SerializeField] private ARAnchorManager anchorManager;
        [SerializeField] private ARRaycastManager raycastManager;

        [Header("UI Panels")]
        [SerializeField] private Canvas mainUI;
        [SerializeField] private GameObject navigationPanel;
        [SerializeField] private GameObject flightInfoPanel;
        [SerializeField] private GameObject baggagePanel;
        [SerializeField] private GameObject servicesPanel;
        [SerializeField] private GameObject settingsPanel;

        [Header("Navigation System")]
        [SerializeField] private NavigationController navigationController;
        [SerializeField] private WaypointManager waypointManager;
        [SerializeField] private PathRenderer pathRenderer;
        [SerializeField] private ARCompass arCompass;

        [Header("Flight Information")]
        [SerializeField] private FlightDisplayController flightDisplay;
        [SerializeField] private GateInfoDisplay gateInfoDisplay;
        [SerializeField] private BoardingPassScanner boardingPassScanner;

        [Header("Interactive Elements")]
        [SerializeField] private TouchInputHandler touchInputHandler;
        [SerializeField] private GestureRecognizer gestureRecognizer;
        [SerializeField] private VoiceCommandController voiceController;

        [Header("Networking")]
        [SerializeField] private string apiBaseUrl = "https://api.aerofusionxr.com";
        [SerializeField] private float updateInterval = 5.0f;

        [Header("Audio")]
        [SerializeField] private AudioSource notificationSound;
        [SerializeField] private AudioSource navigationSound;
        [SerializeField] private AudioClip[] soundEffects;

        // Private variables
        private HttpClient httpClient;
        private UserSession currentSession;
        private List<ARRaycastHit> raycastHits = new List<ARRaycastHit>();
        private Coroutine dataUpdateCoroutine;
        private bool isARInitialized = false;
        private Dictionary<string, GameObject> spawnedObjects = new Dictionary<string, GameObject>();

        // Events
        public static event Action<NavigationData> OnNavigationUpdated;
        public static event Action<FlightData> OnFlightDataUpdated;
        public static event Action<string> OnErrorOccurred;
        public static event Action<bool> OnARStatusChanged;

        // Properties
        public bool IsARActive => arSession.enabled && isARInitialized;
        public UserSession CurrentSession => currentSession;

        private void Awake()
        {
            InitializeComponents();
            SetupEventListeners();
            InitializeHttpClient();
        }

        private void Start()
        {
            StartCoroutine(InitializeARSession());
            LoadUserSession();
            StartDataUpdates();
        }

        private void OnDestroy()
        {
            CleanupResources();
        }

        #region Initialization

        private void InitializeComponents()
        {
            // Ensure all required components are present
            if (arCamera == null) arCamera = FindObjectOfType<ARCamera>();
            if (arSessionOrigin == null) arSessionOrigin = FindObjectOfType<ARSessionOrigin>();
            if (arSession == null) arSession = FindObjectOfType<ARSession>();
            if (planeManager == null) planeManager = FindObjectOfType<ARPlaneManager>();
            if (anchorManager == null) anchorManager = FindObjectOfType<ARAnchorManager>();
            if (raycastManager == null) raycastManager = FindObjectOfType<ARRaycastManager>();

            // Initialize UI state
            ShowPanel(UIPanel.Main);
        }

        private void SetupEventListeners()
        {
            // AR Events
            if (planeManager != null)
            {
                planeManager.planesChanged += OnPlanesChanged;
            }

            // Touch Input Events
            if (touchInputHandler != null)
            {
                touchInputHandler.OnTouchStarted += HandleTouchInput;
                touchInputHandler.OnTouchMoved += HandleTouchMove;
                touchInputHandler.OnTouchEnded += HandleTouchEnd;
            }

            // Gesture Events
            if (gestureRecognizer != null)
            {
                gestureRecognizer.OnTap += HandleTapGesture;
                gestureRecognizer.OnPinch += HandlePinchGesture;
                gestureRecognizer.OnSwipe += HandleSwipeGesture;
            }

            // Voice Commands
            if (voiceController != null)
            {
                voiceController.OnCommandRecognized += HandleVoiceCommand;
            }

            // Navigation Events
            if (navigationController != null)
            {
                navigationController.OnDestinationReached += HandleDestinationReached;
                navigationController.OnRouteUpdated += HandleRouteUpdated;
            }
        }

        private void InitializeHttpClient()
        {
            httpClient = new HttpClient();
            httpClient.BaseAddress = new Uri(apiBaseUrl);
            httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            httpClient.DefaultRequestHeaders.Add("User-Agent", "AeroFusionXR/1.0");
        }

        private IEnumerator InitializeARSession()
        {
            Debug.Log("Initializing AR Session...");
            
            yield return new WaitForSeconds(1.0f);
            
            if (ARSession.state == ARSessionState.None || ARSession.state == ARSessionState.CheckingAvailability)
            {
                yield return ARSession.CheckAvailability();
            }

            if (ARSession.state == ARSessionState.Unsupported)
            {
                Debug.LogError("AR is not supported on this device");
                OnErrorOccurred?.Invoke("AR is not supported on this device");
                yield break;
            }

            if (ARSession.state == ARSessionState.NeedsInstall)
            {
                yield return ARSession.Install();
            }

            if (ARSession.state == ARSessionState.Installing)
            {
                yield return new WaitWhile(() => ARSession.state == ARSessionState.Installing);
            }

            if (ARSession.state != ARSessionState.Ready)
            {
                Debug.LogError("AR failed to initialize");
                OnErrorOccurred?.Invoke("AR failed to initialize");
                yield break;
            }

            arSession.enabled = true;
            isARInitialized = true;
            OnARStatusChanged?.Invoke(true);
            Debug.Log("AR Session initialized successfully");
        }

        #endregion

        #region Data Management

        private async void LoadUserSession()
        {
            try
            {
                string sessionData = PlayerPrefs.GetString("UserSession", "");
                if (!string.IsNullOrEmpty(sessionData))
                {
                    currentSession = JsonConvert.DeserializeObject<UserSession>(sessionData);
                    await RefreshSessionData();
                }
                else
                {
                    // Show login UI or guest mode
                    ShowPanel(UIPanel.Login);
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"Failed to load user session: {ex.Message}");
                OnErrorOccurred?.Invoke("Failed to load user session");
            }
        }

        private void StartDataUpdates()
        {
            if (dataUpdateCoroutine != null)
            {
                StopCoroutine(dataUpdateCoroutine);
            }
            dataUpdateCoroutine = StartCoroutine(UpdateDataPeriodically());
        }

        private IEnumerator UpdateDataPeriodically()
        {
            while (true)
            {
                yield return new WaitForSeconds(updateInterval);
                
                if (currentSession != null && IsARActive)
                {
                    await UpdateFlightData();
                    await UpdateNavigationData();
                    await UpdateBaggageStatus();
                }
            }
        }

        private async Task RefreshSessionData()
        {
            try
            {
                var response = await httpClient.GetAsync($"/api/user/{currentSession.UserId}/profile");
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    var userData = JsonConvert.DeserializeObject<UserData>(content);
                    currentSession.UserData = userData;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"Failed to refresh session data: {ex.Message}");
            }
        }

        private async Task UpdateFlightData()
        {
            try
            {
                if (currentSession?.CurrentBooking != null)
                {
                    var response = await httpClient.GetAsync($"/api/flights/{currentSession.CurrentBooking.FlightId}");
                    if (response.IsSuccessStatusCode)
                    {
                        var content = await response.Content.ReadAsStringAsync();
                        var flightData = JsonConvert.DeserializeObject<FlightData>(content);
                        OnFlightDataUpdated?.Invoke(flightData);
                        
                        if (flightDisplay != null)
                        {
                            flightDisplay.UpdateFlightInfo(flightData);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"Failed to update flight data: {ex.Message}");
            }
        }

        private async Task UpdateNavigationData()
        {
            try
            {
                if (currentSession?.CurrentDestination != null)
                {
                    var response = await httpClient.GetAsync($"/api/navigation/route?from={GetCurrentLocation()}&to={currentSession.CurrentDestination}");
                    if (response.IsSuccessStatusCode)
                    {
                        var content = await response.Content.ReadAsStringAsync();
                        var navigationData = JsonConvert.DeserializeObject<NavigationData>(content);
                        OnNavigationUpdated?.Invoke(navigationData);
                        
                        if (navigationController != null)
                        {
                            navigationController.UpdateRoute(navigationData);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"Failed to update navigation data: {ex.Message}");
            }
        }

        private async Task UpdateBaggageStatus()
        {
            try
            {
                if (currentSession?.BaggageIds != null && currentSession.BaggageIds.Count > 0)
                {
                    foreach (string baggageId in currentSession.BaggageIds)
                    {
                        var response = await httpClient.GetAsync($"/api/baggage/{baggageId}/status");
                        if (response.IsSuccessStatusCode)
                        {
                            var content = await response.Content.ReadAsStringAsync();
                            var baggageStatus = JsonConvert.DeserializeObject<BaggageStatus>(content);
                            // Update baggage display
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"Failed to update baggage status: {ex.Message}");
            }
        }

        #endregion

        #region Event Handlers

        private void OnPlanesChanged(ARPlanesChangedEventArgs eventArgs)
        {
            foreach (var plane in eventArgs.added)
            {
                Debug.Log($"New plane detected: {plane.trackableId}");
                // Handle new plane detection
                HandleNewPlaneDetection(plane);
            }

            foreach (var plane in eventArgs.updated)
            {
                // Handle plane updates
                HandlePlaneUpdate(plane);
            }

            foreach (var plane in eventArgs.removed)
            {
                Debug.Log($"Plane removed: {plane.trackableId}");
                // Handle plane removal
                HandlePlaneRemoval(plane);
            }
        }

        private void HandleTouchInput(Vector2 touchPosition)
        {
            if (raycastManager.Raycast(touchPosition, raycastHits, TrackableType.PlaneWithinPolygon))
            {
                var hitPose = raycastHits[0].pose;
                HandleARTouchInteraction(hitPose);
            }
        }

        private void HandleTouchMove(Vector2 touchPosition)
        {
            // Handle touch move for UI interactions
        }

        private void HandleTouchEnd(Vector2 touchPosition)
        {
            // Handle touch end events
        }

        private void HandleTapGesture(Vector2 position)
        {
            // Handle tap gestures for object selection
            SelectObjectAtPosition(position);
        }

        private void HandlePinchGesture(float pinchDelta)
        {
            // Handle pinch for zoom functionality
            HandleZoom(pinchDelta);
        }

        private void HandleSwipeGesture(Vector2 direction)
        {
            // Handle swipe gestures for navigation
            HandleSwipeNavigation(direction);
        }

        private void HandleVoiceCommand(string command)
        {
            Debug.Log($"Voice command received: {command}");
            ProcessVoiceCommand(command);
        }

        private void HandleDestinationReached()
        {
            Debug.Log("Destination reached!");
            PlayNotificationSound();
            ShowNotification("You have arrived at your destination!");
        }

        private void HandleRouteUpdated(NavigationData navigationData)
        {
            if (pathRenderer != null)
            {
                pathRenderer.UpdatePath(navigationData.Waypoints);
            }
        }

        #endregion

        #region Public Methods

        public void StartNavigation(string destinationId)
        {
            if (navigationController != null)
            {
                navigationController.StartNavigation(destinationId);
            }
        }

        public void StopNavigation()
        {
            if (navigationController != null)
            {
                navigationController.StopNavigation();
            }
        }

        public void ShowPanel(UIPanel panel)
        {
            // Hide all panels first
            navigationPanel.SetActive(false);
            flightInfoPanel.SetActive(false);
            baggagePanel.SetActive(false);
            servicesPanel.SetActive(false);
            settingsPanel.SetActive(false);

            // Show requested panel
            switch (panel)
            {
                case UIPanel.Navigation:
                    navigationPanel.SetActive(true);
                    break;
                case UIPanel.FlightInfo:
                    flightInfoPanel.SetActive(true);
                    break;
                case UIPanel.Baggage:
                    baggagePanel.SetActive(true);
                    break;
                case UIPanel.Services:
                    servicesPanel.SetActive(true);
                    break;
                case UIPanel.Settings:
                    settingsPanel.SetActive(true);
                    break;
            }
        }

        public void ScanBoardingPass()
        {
            if (boardingPassScanner != null)
            {
                boardingPassScanner.StartScan();
            }
        }

        public void PlaceWaypoint(Vector3 position)
        {
            if (waypointManager != null)
            {
                waypointManager.PlaceWaypoint(position);
            }
        }

        #endregion

        #region Private Methods

        private void HandleNewPlaneDetection(ARPlane plane)
        {
            // Enable navigation on plane detection
            if (navigationController != null && !navigationController.IsNavigationActive)
            {
                navigationController.EnableNavigation();
            }
        }

        private void HandlePlaneUpdate(ARPlane plane)
        {
            // Update navigation path if needed
        }

        private void HandlePlaneRemoval(ARPlane plane)
        {
            // Handle plane removal
        }

        private void HandleARTouchInteraction(Pose hitPose)
        {
            // Handle AR touch interactions
            PlaceWaypoint(hitPose.position);
        }

        private void SelectObjectAtPosition(Vector2 screenPosition)
        {
            // Raycast to select objects in AR space
            Ray ray = arCamera.ScreenPointToRay(screenPosition);
            if (Physics.Raycast(ray, out RaycastHit hit))
            {
                var selectableObject = hit.collider.GetComponent<ISelectableObject>();
                selectableObject?.OnSelected();
            }
        }

        private void HandleZoom(float zoomDelta)
        {
            // Implement zoom functionality
        }

        private void HandleSwipeNavigation(Vector2 direction)
        {
            // Handle swipe navigation between UI panels
            if (direction.x > 0.5f)
            {
                // Swipe right - next panel
            }
            else if (direction.x < -0.5f)
            {
                // Swipe left - previous panel
            }
        }

        private void ProcessVoiceCommand(string command)
        {
            command = command.ToLower();
            
            if (command.Contains("navigate to") || command.Contains("go to"))
            {
                string destination = ExtractDestinationFromCommand(command);
                StartNavigation(destination);
            }
            else if (command.Contains("flight info") || command.Contains("flight status"))
            {
                ShowPanel(UIPanel.FlightInfo);
            }
            else if (command.Contains("baggage") || command.Contains("luggage"))
            {
                ShowPanel(UIPanel.Baggage);
            }
            else if (command.Contains("stop navigation"))
            {
                StopNavigation();
            }
        }

        private string ExtractDestinationFromCommand(string command)
        {
            // Simple extraction logic - can be enhanced with NLP
            string[] parts = command.Split(' ');
            for (int i = 0; i < parts.Length - 1; i++)
            {
                if (parts[i] == "to")
                {
                    return parts[i + 1];
                }
            }
            return "";
        }

        private Vector3 GetCurrentLocation()
        {
            // Return current user location in world coordinates
            return arSessionOrigin.transform.position;
        }

        private void PlayNotificationSound()
        {
            if (notificationSound != null && soundEffects.Length > 0)
            {
                notificationSound.PlayOneShot(soundEffects[0]);
            }
        }

        private void ShowNotification(string message)
        {
            // Show UI notification
            Debug.Log($"Notification: {message}");
        }

        private void CleanupResources()
        {
            httpClient?.Dispose();
            
            if (dataUpdateCoroutine != null)
            {
                StopCoroutine(dataUpdateCoroutine);
            }
        }

        #endregion

        #region Data Classes

        [Serializable]
        public class UserSession
        {
            public string UserId;
            public UserData UserData;
            public BookingData CurrentBooking;
            public string CurrentDestination;
            public List<string> BaggageIds;
            public DateTime SessionStart;
        }

        [Serializable]
        public class UserData
        {
            public string Name;
            public string Email;
            public string PreferredLanguage;
            public bool AREnabled;
            public bool VoiceEnabled;
        }

        [Serializable]
        public class BookingData
        {
            public string BookingId;
            public string FlightId;
            public string FlightNumber;
            public DateTime DepartureTime;
            public string DepartureGate;
            public string SeatNumber;
        }

        [Serializable]
        public class FlightData
        {
            public string FlightId;
            public string FlightNumber;
            public string Status;
            public DateTime ScheduledDeparture;
            public DateTime EstimatedDeparture;
            public string Gate;
            public string Terminal;
        }

        [Serializable]
        public class NavigationData
        {
            public List<Vector3> Waypoints;
            public float TotalDistance;
            public float EstimatedTime;
            public string Instructions;
        }

        [Serializable]
        public class BaggageStatus
        {
            public string BaggageId;
            public string Status;
            public string Location;
            public DateTime LastUpdate;
        }

        #endregion

        #region Enums

        public enum UIPanel
        {
            Main,
            Navigation,
            FlightInfo,
            Baggage,
            Services,
            Settings,
            Login
        }

        #endregion
    }

    #region Interfaces

    public interface ISelectableObject
    {
        void OnSelected();
        void OnDeselected();
    }

    #endregion
} 