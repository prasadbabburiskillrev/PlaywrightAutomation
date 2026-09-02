Create a file named "deviceBrowsers.ts" under this path:
C:\Users\LENOVO\Documents\Playwright_Automation\src\utils.

Configure the file for below mentions UI breakpoints with different browsers and modes(Chrome:Head/Headless).

UI Break point for taking Screenshots:

xlDesktop = 1920 * 1080
lDesktop = 1440 * 1080
Desktop = 1024 * 1080
lTablet = 1280 * 800
pTablet  = 768 * 1024
xsMobile = 375 * 1080






Standard UI Testing Ports:

// Desktop & Laptop Breakpoints
xlDesktop = 1920 * 1080  // Full HD Monitors (16:9)
lDesktop  = 1440 * 900   // Laptops / MacBook Pro (16:10)
Desktop   = 1280 * 800   // Small Laptops / Chromebooks (16:10)

// Tablet Breakpoints
lTablet   = 1024 * 768   // Tablet Landscape / iPad Air (4:3)
pTablet   = 768 * 1024   // Tablet Portrait / iPad (4:3)

// Mobile Breakpoints
lMobile   = 414 * 896    // Large Mobile / Pro Max & Plus models
xsMobile  = 375 * 812    // Standard Mobile / iPhone base models & Android mid-range








1) User should able to capture screenshots/test application of anyof these resolution and each screenshot should be saved in screenshots/along with current date and time format including in name/device resolution name(for which screenshots are taking)/Images/screenshots with file names

2) In the same path there should be on folder to safe pdf(with merged screenshots in order) screenshots/along with current date and time format including in name/device resolution name(for which screenshots are taking)/pdfprogramname-device-dateandtime.pdf


