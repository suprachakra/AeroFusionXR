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
import android.hardware.biometrics.BiometricManager;
import android.hardware.camera2.CameraManager;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.pm.PackageManager;
import android.Manifest;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.biometric.BiometricPrompt;
import androidx.fragment.app.FragmentActivity;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

// Google AR Core
import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Config;
import com.google.ar.core.Session;
import com.google.ar.core.exceptions.UnavailableException;

// Firebase
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.analytics.FirebaseAnalytics;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

// HMS (Huawei Mobile Services)
import com.huawei.hms.api.HuaweiApiAvailability;
import com.huawei.hms.push.HmsMessaging;
import com.huawei.agconnect.AGConnectOptionsBuilder;
import com.huawei.agconnect.core.AGConnectInstance;

// AR Engine (Huawei AR)
import com.huawei.hiar.ARConfigBase;
import com.huawei.hiar.ARSession;

// Security
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import java.security.SecureRandom;

// Sensors & Hardware
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;

public class MainActivity extends ReactActivity implements SensorEventListener {

    // AR Session Management
    private Session arCoreSession;
    private ARSession huaweiARSession;
    private boolean isARSupported = false;
    private boolean isHuaweiDevice = false;
    
    // Security
    private BiometricPrompt biometricPrompt;
    private BiometricPrompt.PromptInfo promptInfo;
    private KeyguardManager keyguardManager;
    
    // Sensors
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private Sensor gyroscope;
    private Sensor magnetometer;
    private Sensor lightSensor;
    private Sensor proximitySensor;
    private Sensor stepCounter;
    
    // Connectivity
    private NfcAdapter nfcAdapter;
    private BluetoothAdapter bluetoothAdapter;
    private LocationManager locationManager;
    
    // Analytics
    private FirebaseAnalytics firebaseAnalytics;
    private FirebaseCrashlytics crashlytics;
    
    // Permission Request Codes
    private static final int CAMERA_PERMISSION_CODE = 100;
    private static final int LOCATION_PERMISSION_CODE = 101;
    private static final int BLUETOOTH_PERMISSION_CODE = 102;
    private static final int STORAGE_PERMISSION_CODE = 103;
    private static final int MICROPHONE_PERMISSION_CODE = 104;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize device detection
        detectDeviceType();
        
        // Initialize security systems
        initializeSecurity();
        
        // Initialize sensors
        initializeSensors();
        
        // Initialize connectivity
        initializeConnectivity();
        
        // Initialize Firebase/HMS
        initializeServices();
        
        // Initialize AR capabilities
        initializeAR();
        
        // Request permissions
        requestNecessaryPermissions();
        
        // Setup biometric authentication
        setupBiometricAuth();
    }

    private void detectDeviceType() {
        // Check if Huawei device
        try {
            String manufacturer = android.os.Build.MANUFACTURER.toLowerCase();
            isHuaweiDevice = manufacturer.contains("huawei") || manufacturer.contains("honor");
            
            if (isHuaweiDevice) {
                // Check HMS availability
                HuaweiApiAvailability huaweiApiAvailability = HuaweiApiAvailability.getInstance();
                int result = huaweiApiAvailability.isHuaweiMobileServicesAvailable(this);
                if (result == com.huawei.hms.api.ConnectionResult.SUCCESS) {
                    // HMS is available
                    initializeHMS();
                }
            }
        } catch (Exception e) {
            FirebaseCrashlytics.getInstance().recordException(e);
        }
    }

    private void initializeHMS() {
        try {
            // Initialize AGConnect
            AGConnectInstance.initialize(getApplicationContext());
            
            // Initialize HMS Push
            HmsMessaging.getInstance(this).turnOnPush().addOnCompleteListener(task -> {
                if (task.isSuccessful()) {
                    android.util.Log.d("AeroFusionXR", "HMS Push initialized successfully");
                } else {
                    android.util.Log.e("AeroFusionXR", "HMS Push initialization failed", task.getException());
                }
            });
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR", "HMS initialization failed", e);
        }
    }

    private void initializeSecurity() {
        keyguardManager = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        
        // Initialize hardware security
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            
            // Generate encryption keys for secure storage
            KeyGenerator keyGenerator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
            
        } catch (Exception e) {
            FirebaseCrashlytics.getInstance().recordException(e);
        }
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
        
        // Register sensor listeners
        if (accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
        }
        if (gyroscope != null) {
            sensorManager.registerListener(this, gyroscope, SensorManager.SENSOR_DELAY_GAME);
        }
        if (magnetometer != null) {
            sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_GAME);
        }
    }

    private void initializeConnectivity() {
        // NFC
        NfcManager nfcManager = (NfcManager) getSystemService(NFC_SERVICE);
        if (nfcManager != null) {
            nfcAdapter = nfcManager.getDefaultAdapter();
        }
        
        // Bluetooth
        BluetoothManager bluetoothManager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
        }
        
        // Location
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
    }

    private void initializeServices() {
        if (!isHuaweiDevice) {
            // Initialize Firebase for non-Huawei devices
            try {
                FirebaseApp.initializeApp(this);
                firebaseAnalytics = FirebaseAnalytics.getInstance(this);
                crashlytics = FirebaseCrashlytics.getInstance();
                
                // Get FCM token
                FirebaseMessaging.getInstance().getToken()
                    .addOnCompleteListener(task -> {
                        if (!task.isSuccessful()) {
                            android.util.Log.w("AeroFusionXR", "Fetching FCM registration token failed", task.getException());
                            return;
                        }
                        
                        String token = task.getResult();
                        android.util.Log.d("AeroFusionXR", "FCM Registration Token: " + token);
                        
                        // Send token to React Native
                        sendTokenToReactNative(token);
                    });
                    
            } catch (Exception e) {
                android.util.Log.e("AeroFusionXR", "Firebase initialization failed", e);
            }
        }
    }

    private void initializeAR() {
        try {
            if (isHuaweiDevice) {
                // Initialize Huawei AR Engine
                initializeHuaweiAR();
            } else {
                // Initialize Google ARCore
                initializeARCore();
            }
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR", "AR initialization failed", e);
        }
    }

    private void initializeARCore() {
        try {
            // Check ARCore availability
            ArCoreApk.Availability availability = ArCoreApk.getInstance().checkAvailability(this);
            
            if (availability == ArCoreApk.Availability.SUPPORTED_INSTALLED) {
                // ARCore is installed and supported
                arCoreSession = new Session(this);
                
                Config config = new Config(arCoreSession);
                config.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
                config.setLightEstimationMode(Config.LightEstimationMode.ENVIRONMENTAL_HDR);
                config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL);
                config.setInstantPlacementMode(Config.InstantPlacementMode.LOCAL_Y_UP);
                
                arCoreSession.configure(config);
                
                isARSupported = true;
                android.util.Log.d("AeroFusionXR", "ARCore initialized successfully");
                
            } else if (availability == ArCoreApk.Availability.SUPPORTED_NOT_INSTALLED) {
                // Request ARCore installation
                ArCoreApk.getInstance().requestInstall(this, true);
            }
        } catch (UnavailableException e) {
            android.util.Log.e("AeroFusionXR", "ARCore initialization failed", e);
        }
    }

    private void initializeHuaweiAR() {
        try {
            // Check Huawei AR Engine availability
            huaweiARSession = new ARSession(this);
            
            ARConfigBase config = new ARConfigBase(huaweiARSession);
            config.setPowerMode(ARConfigBase.PowerMode.NORMAL);
            config.setUpdateMode(ARConfigBase.UpdateMode.LATEST_CAMERA_IMAGE);
            config.setPlaneFindingMode(ARConfigBase.PlaneFindingMode.ENABLE);
            
            huaweiARSession.configure(config);
            
            isARSupported = true;
            android.util.Log.d("AeroFusionXR", "Huawei AR Engine initialized successfully");
            
        } catch (Exception e) {
            android.util.Log.e("AeroFusionXR", "Huawei AR Engine initialization failed", e);
        }
    }

    private void setupBiometricAuth() {
        try {
            BiometricManager biometricManager = BiometricManager.from(this);
            
            switch (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)) {
                case BiometricManager.BIOMETRIC_SUCCESS:
                    // Biometric authentication is available
                    initializeBiometricPrompt();
                    break;
                case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                    android.util.Log.d("AeroFusionXR", "No biometric features available on this device");
                    break;
                case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                    android.util.Log.d("AeroFusionXR", "Biometric features are currently unavailable");
                    break;
                case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                    android.util.Log.d("AeroFusionXR", "No biometric credentials enrolled");
                    break;
            }
        } catch (Exception e) {
            FirebaseCrashlytics.getInstance().recordException(e);
        }
    }

    private void initializeBiometricPrompt() {
        biometricPrompt = new BiometricPrompt((FragmentActivity) this,
            ContextCompat.getMainExecutor(this),
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationError(int errorCode, CharSequence errString) {
                    super.onAuthenticationError(errorCode, errString);
                    android.util.Log.e("AeroFusionXR", "Biometric authentication error: " + errString);
                }

                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    super.onAuthenticationSucceeded(result);
                    android.util.Log.d("AeroFusionXR", "Biometric authentication succeeded");
                    // Notify React Native
                    sendBiometricResultToReactNative(true);
                }

                @Override
                public void onAuthenticationFailed() {
                    super.onAuthenticationFailed();
                    android.util.Log.e("AeroFusionXR", "Biometric authentication failed");
                    sendBiometricResultToReactNative(false);
                }
            });

        promptInfo = new BiometricPrompt.PromptInfo.Builder()
            .setTitle("AeroFusionXR Biometric Authentication")
            .setSubtitle("Use your fingerprint or face to authenticate")
            .setNegativeButtonText("Use password instead")
            .build();
    }

    private void requestNecessaryPermissions() {
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
            Manifest.permission.VIBRATE
        };

        boolean allGranted = true;
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (!allGranted) {
            ActivityCompat.requestPermissions(this, permissions, 1000);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        // Handle sensor data for AR and navigation
        switch (event.sensor.getType()) {
            case Sensor.TYPE_ACCELEROMETER:
                // Handle accelerometer data
                sendSensorDataToReactNative("accelerometer", event.values);
                break;
            case Sensor.TYPE_GYROSCOPE:
                // Handle gyroscope data
                sendSensorDataToReactNative("gyroscope", event.values);
                break;
            case Sensor.TYPE_MAGNETIC_FIELD:
                // Handle magnetometer data
                sendSensorDataToReactNative("magnetometer", event.values);
                break;
            case Sensor.TYPE_LIGHT:
                // Handle ambient light data
                sendSensorDataToReactNative("light", event.values);
                break;
            case Sensor.TYPE_PROXIMITY:
                // Handle proximity data
                sendSensorDataToReactNative("proximity", event.values);
                break;
            case Sensor.TYPE_STEP_COUNTER:
                // Handle step counter data
                sendSensorDataToReactNative("stepCounter", event.values);
                break;
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Handle sensor accuracy changes
    }

    // Helper methods to communicate with React Native
    private void sendTokenToReactNative(String token) {
        // Send FCM/HMS token to React Native
        getReactInstanceManager().getCurrentReactContext()
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("fcmTokenReceived", token);
    }

    private void sendBiometricResultToReactNative(boolean success) {
        getReactInstanceManager().getCurrentReactContext()
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("biometricAuthResult", success);
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

        getReactInstanceManager().getCurrentReactContext()
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("sensorData", params);
    }

    @Override
    protected void onResume() {
        super.onResume();
        
        // Resume AR session
        if (arCoreSession != null) {
            try {
                arCoreSession.resume();
            } catch (Exception e) {
                android.util.Log.e("AeroFusionXR", "Failed to resume ARCore session", e);
            }
        }
        
        if (huaweiARSession != null) {
            try {
                huaweiARSession.resume();
            } catch (Exception e) {
                android.util.Log.e("AeroFusionXR", "Failed to resume Huawei AR session", e);
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        
        // Pause AR session
        if (arCoreSession != null) {
            arCoreSession.pause();
        }
        
        if (huaweiARSession != null) {
            huaweiARSession.pause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        
        // Cleanup AR sessions
        if (arCoreSession != null) {
            arCoreSession.close();
        }
        
        if (huaweiARSession != null) {
            huaweiARSession.stop();
        }
        
        // Unregister sensor listeners
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    @Override
    protected String getMainComponentName() {
        return "AeroFusionXR";
    }

    /**
     * Returns the instance of the {@link ReactActivityDelegate}. Here we use a util class {@link
     * DefaultReactActivityDelegate} which allows you to easily enable Fabric and Concurrent React
     * (aka React 18) with two boolean flags.
     */
    @Override
    protected ReactActivityDelegate createReactActivityDelegate() {
        return new DefaultReactActivityDelegate(
            this,
            getMainComponentName(),
            // If you opted-in for the New Architecture, we enable the Fabric Renderer.
            DefaultNewArchitectureEntryPoint.getFabricEnabled());
    }
} 