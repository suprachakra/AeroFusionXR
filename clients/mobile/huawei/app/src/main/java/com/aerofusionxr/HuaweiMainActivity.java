package com.aerofusionxr;

import android.os.Bundle;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.location.LocationManager;
import android.nfc.NfcAdapter;
import android.nfc.NfcManager;
import android.app.KeyguardManager;
import android.content.pm.PackageManager;
import android.Manifest;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

// Huawei Mobile Services (HMS)
import com.huawei.hms.api.HuaweiApiAvailability;
import com.huawei.hms.push.HmsMessaging;
import com.huawei.hms.push.RemoteMessage;
import com.huawei.agconnect.AGConnectInstance;
import com.huawei.agconnect.AGConnectOptionsBuilder;
import com.huawei.agconnect.core.AGConnectInstance;

// Huawei Analytics & Crash
import com.huawei.hms.analytics.HiAnalytics;
import com.huawei.hms.analytics.HiAnalyticsInstance;
import com.huawei.hms.analytics.HiAnalyticsTools;
import com.huawei.agconnect.crash.AGConnectCrash;

// Huawei AR Engine
import com.huawei.hiar.ARSession;
import com.huawei.hiar.ARConfigBase;
import com.huawei.hiar.ARWorldTrackingConfig;
import com.huawei.hiar.ARFaceTrackingConfig;
import com.huawei.hiar.ARHandTrackingConfig;
import com.huawei.hiar.ARBodyTrackingConfig;
import com.huawei.hiar.exceptions.ARUnavailableException;
import com.huawei.hiar.exceptions.ARUnSupportedConfigurationException;
import com.huawei.hiar.exceptions.ARUnavailableServiceNotInstalledException;

// Huawei Location Services
import com.huawei.hms.location.LocationServices;
import com.huawei.hms.location.FusedLocationProviderClient;
import com.huawei.hms.location.LocationRequest;
import com.huawei.hms.location.LocationCallback;
import com.huawei.hms.location.LocationResult;
import com.huawei.hms.location.SettingsClient;
import com.huawei.hms.location.LocationSettingsRequest;

// Huawei Account & Security
import com.huawei.hms.support.account.AccountAuthManager;
import com.huawei.hms.support.account.request.AccountAuthParams;
import com.huawei.hms.support.account.request.AccountAuthParamsHelper;
import com.huawei.hms.support.account.service.AccountAuthService;
import com.huawei.hms.support.hwid.ui.HuaweiIdAuthButton;
import com.huawei.hms.support.fingerprint.FingerprintManager;

// Huawei Maps
import com.huawei.hms.maps.HuaweiMap;
import com.huawei.hms.maps.MapView;
import com.huawei.hms.maps.MapsInitializer;
import com.huawei.hms.maps.OnMapReadyCallback;

// Huawei ML Kit
import com.huawei.hms.mlsdk.MLAnalyzerFactory;
import com.huawei.hms.mlsdk.common.MLApplication;
import com.huawei.hms.mlsdk.face.MLFaceAnalyzer;
import com.huawei.hms.mlsdk.text.MLTextAnalyzer;
import com.huawei.hms.mlsdk.classification.MLImageClassificationAnalyzer;
import com.huawei.hms.mlsdk.translate.MLTranslatorFactory;

// Huawei Scan Kit
import com.huawei.hms.hmsscankit.ScanUtil;
import com.huawei.hms.ml.scan.HmsScan;
import com.huawei.hms.ml.scan.HmsScanAnalyzer;

// Huawei Safety Detect
import com.huawei.hms.support.api.safetydetect.SafetyDetect;
import com.huawei.hms.support.api.safetydetect.SafetyDetectClient;

// Huawei Awareness Kit
import com.huawei.hms.kit.awareness.Awareness;
import com.huawei.hms.kit.awareness.status.AwarenessStatusCodes;
import com.huawei.hms.kit.awareness.capture.AmbientLightResponse;
import com.huawei.hms.kit.awareness.capture.HeadsetResponse;
import com.huawei.hms.kit.awareness.capture.LocationResponse;

// HarmonyOS Features
import com.huawei.hmf.tasks.Task;
import com.huawei.hmf.tasks.OnSuccessListener;
import com.huawei.hmf.tasks.OnFailureListener;

// Security
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import java.security.SecureRandom;

// Sensors & Hardware
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;

public class HuaweiMainActivity extends ReactActivity implements SensorEventListener {

    // HMS Services
    private HiAnalyticsInstance analyticsInstance;
    private AGConnectCrash crashService;
    private FusedLocationProviderClient fusedLocationClient;
    private AccountAuthService accountAuthService;
    private SafetyDetectClient safetyDetectClient;
    
    // AR Session Management
    private ARSession huaweiARSession;
    private ARWorldTrackingConfig worldTrackingConfig;
    private ARFaceTrackingConfig faceTrackingConfig;
    private ARHandTrackingConfig handTrackingConfig;
    private ARBodyTrackingConfig bodyTrackingConfig;
    private boolean isARSupported = false;
    
    // Security & Biometrics
    private FingerprintManager fingerprintManager;
    private KeyguardManager keyguardManager;
    
    // Sensors
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private Sensor gyroscope;
    private Sensor magnetometer;
    private Sensor lightSensor;
    private Sensor proximitySensor;
    private Sensor stepCounter;
    private Sensor gravitySensor;
    private Sensor rotationVectorSensor;
    
    // ML Services
    private MLFaceAnalyzer faceAnalyzer;
    private MLTextAnalyzer textAnalyzer;
    private MLImageClassificationAnalyzer imageClassificationAnalyzer;
    private HmsScanAnalyzer scanAnalyzer;
    
    // Connectivity
    private NfcAdapter nfcAdapter;
    private LocationManager locationManager;
    
    // Permission Request Codes
    private static final int HMS_LOCATION_PERMISSION_CODE = 200;
    private static final int HMS_CAMERA_PERMISSION_CODE = 201;
    private static final int HMS_MICROPHONE_PERMISSION_CODE = 202;
    private static final int HMS_STORAGE_PERMISSION_CODE = 203;
    private static final int HMS_BLUETOOTH_PERMISSION_CODE = 204;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize HMS Core
        initializeHMSCore();
        
        // Initialize Analytics
        initializeAnalytics();
        
        // Initialize Security
        initializeSecurity();
        
        // Initialize Sensors
        initializeSensors();
        
        // Initialize Location Services
        initializeLocationServices();
        
        // Initialize AR Engine
        initializeHuaweiAR();
        
        // Initialize ML Kit
        initializeMLKit();
        
        // Initialize Maps
        initializeHuaweiMaps();
        
        // Initialize Safety Detect
        initializeSafetyDetect();
        
        // Initialize Awareness Kit
        initializeAwarenessKit();
        
        // Request permissions
        requestHMSPermissions();
        
        // Setup push notifications
        setupHMSPush();
        
        // Initialize Account Services
        initializeAccountServices();
    }

    private void initializeHMSCore() {
        try {
            // Initialize AGConnect
            AGConnectInstance.initialize(getApplicationContext());
            
            // Check HMS availability
            HuaweiApiAvailability huaweiApiAvailability = HuaweiApiAvailability.getInstance();
            int result = huaweiApiAvailability.isHuaweiMobileServicesAvailable(this);
            
            if (result == com.huawei.hms.api.ConnectionResult.SUCCESS) {
                android.util.Log.d("AeroFusionXR-HMS", "HMS Core is available");
            } else {
                android.util.Log.e("AeroFusionXR-HMS", "HMS Core is not available: " + result);
                // Handle HMS unavailability
                showHMSErrorDialog(result);
            }
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR-HMS", "HMS Core initialization failed", e);
        }
    }

    private void initializeAnalytics() {
        try {
            // Enable Analytics Collection
            HiAnalyticsTools.enableLog();
            analyticsInstance = HiAnalytics.getInstance(this);
            
            // Initialize Crash Service
            crashService = AGConnectCrash.getInstance();
            crashService.enableCrashCollection(true);
            
            android.util.Log.d("AeroFusionXR-HMS", "Analytics and Crash services initialized");
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR-HMS", "Analytics initialization failed", e);
        }
    }

    private void initializeSecurity() {
        keyguardManager = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        fingerprintManager = FingerprintManager.from(this);
        
        // Initialize hardware security
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            
            // Generate encryption keys for secure storage
            KeyGenerator keyGenerator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
            
        } catch (Exception e) {
            crashService.recordException(e);
        }
        
        android.util.Log.d("AeroFusionXR-HMS", "Security services initialized");
    }

    private void initializeSensors() {
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        
        // Initialize all available sensors
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
        magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        lightSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT);
        proximitySensor = sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY);
        stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        gravitySensor = sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY);
        rotationVectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        
        // Register sensor listeners with higher frequency for AR
        if (accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_FASTEST);
        }
        if (gyroscope != null) {
            sensorManager.registerListener(this, gyroscope, SensorManager.SENSOR_DELAY_FASTEST);
        }
        if (magnetometer != null) {
            sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_FASTEST);
        }
        if (rotationVectorSensor != null) {
            sensorManager.registerListener(this, rotationVectorSensor, SensorManager.SENSOR_DELAY_FASTEST);
        }
        
        android.util.Log.d("AeroFusionXR-HMS", "Sensor services initialized");
    }

    private void initializeLocationServices() {
        try {
            fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
            
            LocationRequest locationRequest = LocationRequest.create();
            locationRequest.setInterval(1000); // 1 second
            locationRequest.setFastestInterval(500); // 0.5 seconds
            locationRequest.setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY);
            
            LocationCallback locationCallback = new LocationCallback() {
                @Override
                public void onLocationResult(LocationResult locationResult) {
                    if (locationResult == null) {
                        return;
                    }
                    for (android.location.Location location : locationResult.getLocations()) {
                        handleLocationUpdate(location);
                    }
                }
            };
            
            android.util.Log.d("AeroFusionXR-HMS", "Location services initialized");
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR-HMS", "Location services initialization failed", e);
        }
    }

    private void initializeHuaweiAR() {
        try {
            // Initialize AR Session
            huaweiARSession = new ARSession(this);
            
            // Configure World Tracking
            worldTrackingConfig = new ARWorldTrackingConfig(huaweiARSession);
            worldTrackingConfig.setPowerMode(ARConfigBase.PowerMode.ULTRA_POWER_SAVING);
            worldTrackingConfig.setUpdateMode(ARConfigBase.UpdateMode.LATEST_CAMERA_IMAGE);
            worldTrackingConfig.setPlaneFindingMode(ARConfigBase.PlaneFindingMode.ENABLE);
            worldTrackingConfig.setLightEstimationMode(ARConfigBase.LightEstimationMode.ENABLE);
            worldTrackingConfig.setSemanticMode(ARConfigBase.SemanticMode.PLANE);
            
            // Configure Face Tracking
            faceTrackingConfig = new ARFaceTrackingConfig(huaweiARSession);
            faceTrackingConfig.setPowerMode(ARConfigBase.PowerMode.PERFORMANCE_FIRST);
            faceTrackingConfig.setUpdateMode(ARConfigBase.UpdateMode.LATEST_CAMERA_IMAGE);
            
            // Configure Hand Tracking
            handTrackingConfig = new ARHandTrackingConfig(huaweiARSession);
            handTrackingConfig.setPowerMode(ARConfigBase.PowerMode.PERFORMANCE_FIRST);
            handTrackingConfig.setUpdateMode(ARConfigBase.UpdateMode.LATEST_CAMERA_IMAGE);
            handTrackingConfig.setCameraLensFacing(ARConfigBase.CameraLensFacing.FRONT);
            
            // Configure Body Tracking
            bodyTrackingConfig = new ARBodyTrackingConfig(huaweiARSession);
            bodyTrackingConfig.setPowerMode(ARConfigBase.PowerMode.PERFORMANCE_FIRST);
            bodyTrackingConfig.setUpdateMode(ARConfigBase.UpdateMode.LATEST_CAMERA_IMAGE);
            
            // Start with World Tracking by default
            huaweiARSession.configure(worldTrackingConfig);
            huaweiARSession.resume();
            
            isARSupported = true;
            android.util.Log.d("AeroFusionXR-HMS", "Huawei AR Engine initialized successfully");
            
        } catch (ARUnavailableException | ARUnSupportedConfigurationException | ARUnavailableServiceNotInstalledException e) {
            android.util.Log.e("AeroFusionXR-HMS", "Huawei AR Engine initialization failed", e);
            isARSupported = false;
        }
    }

    private void initializeMLKit() {
        try {
            // Set API Key for ML Kit
            MLApplication.getInstance().setApiKey("YOUR_HMS_ML_API_KEY");
            
            // Initialize Face Analyzer
            faceAnalyzer = MLAnalyzerFactory.getInstance().getFaceAnalyzer();
            
            // Initialize Text Analyzer
            textAnalyzer = MLAnalyzerFactory.getInstance().getLocalTextAnalyzer();
            
            // Initialize Image Classification
            imageClassificationAnalyzer = MLAnalyzerFactory.getInstance().getLocalImageClassificationAnalyzer();
            
            // Initialize Scan Kit
            scanAnalyzer = new HmsScanAnalyzer.Creator(this)
                .setHmsScanTypes(HmsScan.QRCODE_SCAN_TYPE, HmsScan.DATAMATRIX_SCAN_TYPE)
                .create();
            
            android.util.Log.d("AeroFusionXR-HMS", "ML Kit services initialized");
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR-HMS", "ML Kit initialization failed", e);
        }
    }

    private void initializeHuaweiMaps() {
        try {
            // Initialize Huawei Maps
            MapsInitializer.initialize(this);
            MapsInitializer.setApiKey("YOUR_HUAWEI_MAPS_API_KEY");
            
            android.util.Log.d("AeroFusionXR-HMS", "Huawei Maps initialized");
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR-HMS", "Huawei Maps initialization failed", e);
        }
    }

    private void initializeSafetyDetect() {
        try {
            safetyDetectClient = SafetyDetect.getClient(this);
            
            // Check if device is secure
            safetyDetectClient.isVerifyAppsCheck()
                .addOnSuccessListener(new OnSuccessListener<Boolean>() {
                    @Override
                    public void onSuccess(Boolean aBoolean) {
                        android.util.Log.d("AeroFusionXR-HMS", "Device security verified: " + aBoolean);
                        sendSecurityStatusToReactNative(aBoolean);
                    }
                })
                .addOnFailureListener(new OnFailureListener() {
                    @Override
                    public void onFailure(Exception e) {
                        android.util.Log.e("AeroFusionXR-HMS", "Security verification failed", e);
                    }
                });
            
            android.util.Log.d("AeroFusionXR-HMS", "Safety Detect initialized");
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR-HMS", "Safety Detect initialization failed", e);
        }
    }

    private void initializeAwarenessKit() {
        try {
            // Initialize Awareness Kit for contextual information
            Awareness.getCaptureClient(this).getLocation()
                .addOnSuccessListener(new OnSuccessListener<LocationResponse>() {
                    @Override
                    public void onSuccess(LocationResponse locationResponse) {
                        android.location.Location location = locationResponse.getLocation();
                        handleLocationUpdate(location);
                    }
                })
                .addOnFailureListener(new OnFailureListener() {
                    @Override
                    public void onFailure(Exception e) {
                        android.util.Log.e("AeroFusionXR-HMS", "Awareness location failed", e);
                    }
                });
            
            android.util.Log.d("AeroFusionXR-HMS", "Awareness Kit initialized");
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR-HMS", "Awareness Kit initialization failed", e);
        }
    }

    private void setupHMSPush() {
        try {
            // Turn on push notifications
            HmsMessaging.getInstance(this).turnOnPush().addOnCompleteListener(task -> {
                if (task.isSuccessful()) {
                    android.util.Log.d("AeroFusionXR-HMS", "HMS Push enabled successfully");
                    
                    // Get push token
                    HmsMessaging.getInstance(this).getToken().addOnCompleteListener(tokenTask -> {
                        if (tokenTask.isSuccessful()) {
                            String token = tokenTask.getResult();
                            android.util.Log.d("AeroFusionXR-HMS", "HMS Push Token: " + token);
                            sendTokenToReactNative(token);
                        } else {
                            android.util.Log.e("AeroFusionXR-HMS", "Failed to get HMS push token", tokenTask.getException());
                        }
                    });
                    
                } else {
                    android.util.Log.e("AeroFusionXR-HMS", "HMS Push enabling failed", task.getException());
                }
            });
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR-HMS", "HMS Push setup failed", e);
        }
    }

    private void initializeAccountServices() {
        try {
            // Configure Huawei ID sign-in
            AccountAuthParams authParams = new AccountAuthParamsHelper(AccountAuthParams.DEFAULT_AUTH_REQUEST_PARAM)
                .setProfile()
                .setEmail()
                .createParams();
            
            accountAuthService = AccountAuthManager.getService(this, authParams);
            
            android.util.Log.d("AeroFusionXR-HMS", "Account services initialized");
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR-HMS", "Account services initialization failed", e);
        }
    }

    private void requestHMSPermissions() {
        String[] permissions = {
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE,
            Manifest.permission.BLUETOOTH,
            Manifest.permission.BLUETOOTH_ADMIN,
            Manifest.permission.NFC,
            Manifest.permission.ACCESS_NETWORK_STATE,
            Manifest.permission.INTERNET,
            Manifest.permission.WAKE_LOCK,
            Manifest.permission.VIBRATE,
            "com.huawei.hms.permission.ACTIVITY_RECOGNITION"
        };

        boolean allGranted = true;
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (!allGranted) {
            ActivityCompat.requestPermissions(this, permissions, 2000);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        // Handle sensor data optimized for Huawei devices
        switch (event.sensor.getType()) {
            case Sensor.TYPE_ACCELEROMETER:
                sendSensorDataToReactNative("accelerometer", event.values);
                break;
            case Sensor.TYPE_GYROSCOPE:
                sendSensorDataToReactNative("gyroscope", event.values);
                break;
            case Sensor.TYPE_MAGNETIC_FIELD:
                sendSensorDataToReactNative("magnetometer", event.values);
                break;
            case Sensor.TYPE_GRAVITY:
                sendSensorDataToReactNative("gravity", event.values);
                break;
            case Sensor.TYPE_ROTATION_VECTOR:
                sendSensorDataToReactNative("rotationVector", event.values);
                break;
            case Sensor.TYPE_LIGHT:
                sendSensorDataToReactNative("light", event.values);
                break;
            case Sensor.TYPE_PROXIMITY:
                sendSensorDataToReactNative("proximity", event.values);
                break;
            case Sensor.TYPE_STEP_COUNTER:
                sendSensorDataToReactNative("stepCounter", event.values);
                break;
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Handle sensor accuracy changes
    }

    // Helper methods
    private void handleLocationUpdate(android.location.Location location) {
        com.facebook.react.bridge.WritableMap locationData = com.facebook.react.bridge.Arguments.createMap();
        locationData.putDouble("latitude", location.getLatitude());
        locationData.putDouble("longitude", location.getLongitude());
        locationData.putDouble("altitude", location.getAltitude());
        locationData.putDouble("accuracy", location.getAccuracy());
        locationData.putDouble("timestamp", location.getTime());
        locationData.putString("provider", "HMS");

        getReactInstanceManager().getCurrentReactContext()
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("locationUpdate", locationData);
    }

    private void sendTokenToReactNative(String token) {
        getReactInstanceManager().getCurrentReactContext()
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("hmsPushTokenReceived", token);
    }

    private void sendSecurityStatusToReactNative(boolean isSecure) {
        getReactInstanceManager().getCurrentReactContext()
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("deviceSecurityStatus", isSecure);
    }

    private void sendSensorDataToReactNative(String sensorType, float[] values) {
        com.facebook.react.bridge.WritableMap params = com.facebook.react.bridge.Arguments.createMap();
        params.putString("type", sensorType);
        
        com.facebook.react.bridge.WritableArray valuesArray = com.facebook.react.bridge.Arguments.createArray();
        for (float value : values) {
            valuesArray.pushDouble(value);
        }
        params.putArray("values", valuesArray);
        params.putDouble("timestamp", System.currentTimeMillis());
        params.putString("provider", "HMS");

        getReactInstanceManager().getCurrentReactContext()
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("sensorData", params);
    }

    private void showHMSErrorDialog(int errorCode) {
        // Show appropriate error dialog for HMS unavailability
        // This would typically show a dialog asking user to install HMS
    }

    // AR Mode Switching
    public void switchARMode(String mode) {
        try {
            if (huaweiARSession != null) {
                huaweiARSession.pause();
                
                switch (mode) {
                    case "world":
                        huaweiARSession.configure(worldTrackingConfig);
                        break;
                    case "face":
                        huaweiARSession.configure(faceTrackingConfig);
                        break;
                    case "hand":
                        huaweiARSession.configure(handTrackingConfig);
                        break;
                    case "body":
                        huaweiARSession.configure(bodyTrackingConfig);
                        break;
                    default:
                        huaweiARSession.configure(worldTrackingConfig);
                }
                
                huaweiARSession.resume();
                android.util.Log.d("AeroFusionXR-HMS", "AR mode switched to: " + mode);
            }
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR-HMS", "Failed to switch AR mode", e);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        
        if (huaweiARSession != null) {
            try {
                huaweiARSession.resume();
            } catch (Exception e) {
                android.util.Log.e("AeroFusionXR-HMS", "Failed to resume Huawei AR session", e);
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        
        if (huaweiARSession != null) {
            huaweiARSession.pause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        
        // Cleanup AR session
        if (huaweiARSession != null) {
            huaweiARSession.stop();
        }
        
        // Cleanup ML analyzers
        if (faceAnalyzer != null) {
            try {
                faceAnalyzer.stop();
            } catch (Exception e) {
                android.util.Log.e("AeroFusionXR-HMS", "Error stopping face analyzer", e);
            }
        }
        
        if (textAnalyzer != null) {
            try {
                textAnalyzer.stop();
            } catch (Exception e) {
                android.util.Log.e("AeroFusionXR-HMS", "Error stopping text analyzer", e);
            }
        }
        
        if (imageClassificationAnalyzer != null) {
            try {
                imageClassificationAnalyzer.stop();
            } catch (Exception e) {
                android.util.Log.e("AeroFusionXR-HMS", "Error stopping image classification analyzer", e);
            }
        }
        
        // Unregister sensor listeners
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    protected String getMainComponentName() {
        return "AeroFusionXR";
    }

    @Override
    protected ReactActivityDelegate createReactActivityDelegate() {
        return new DefaultReactActivityDelegate(
            this,
            getMainComponentName(),
            DefaultNewArchitectureEntryPoint.getFabricEnabled());
    }
} 