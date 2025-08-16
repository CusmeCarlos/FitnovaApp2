// src/app/shared/utils/device.utils.ts

/**
 * Gathers information about the user's device and browser
 * @returns An object containing device information
 */
export function getDeviceInfo() {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isBrowser: false,
      timestamp: new Date().toISOString()
    };
  }

  return {
    // Basic device info
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    
    // Device capabilities
    touchSupport: 'ontouchstart' in window || 
                 (navigator as any).maxTouchPoints > 0 || 
                 (navigator as any).msMaxTouchPoints > 0,
    
    // WebRTC support
    webRTC: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    
    // Timezone and locale
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    
    // Timestamp
    timestamp: new Date().toISOString(),
    
    // Additional useful info
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack === '1' || (navigator as any).msDoNotTrack === '1',
    
    // Memory info (if available)
    deviceMemory: (navigator as any).deviceMemory,
    hardwareConcurrency: (navigator as any).hardwareConcurrency,
    
    // Connection info (if available)
    connection: (navigator as any).connection ? {
      effectiveType: (navigator as any).connection.effectiveType,
      downlink: (navigator as any).connection.downlink,
      rtt: (navigator as any).connection.rtt,
      saveData: (navigator as any).connection.saveData,
    } : null
  };
}

/**
 * Checks if the device meets the minimum requirements for the app
 * @returns Object with compatibility info
 */
export function checkDeviceCompatibility() {
  const info = getDeviceInfo();
  
  // Basic compatibility checks
  const isCompatible = {
    webRTC: info.webRTC,
    touchSupport: info.touchSupport,
  };
  
  return {
    ...info,
    isCompatible: Object.values(isCompatible).every(Boolean),
    compatibilityIssues: Object.entries(isCompatible)
      .filter(([_, value]) => !value)
      .map(([key]) => key)
  };
}
