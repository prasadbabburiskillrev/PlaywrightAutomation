Create a file named "deviceBrowsers.ts" under this path:
C:\Users\LENOVO\Documents\Playwright_Automation\src\utils.

Configure the file for below mentions UI breakpoints with different browser modes(Chrome:Head/Headless).

UI Break point for taking Screenshots:

xlDesktop = 1920 * 1080
lDesktop = 1440 * 1080
Desktop = 1024 * 1080
lTablet = 1280 * 800
pTablet  = 768 * 1024
xsMobile = 375 * 1080

1) User should able to capture screenshots/test application of anyof these resolution and each screenshot should be saved in screenshots/along with current date and time format including in name/device resolution name(for which screenshots are taking)/Images/screenshots with file names

2) In the same path there should be on folder to safe pdf(with merged screenshots in order) screenshots/along with current date and time format including in name/device resolution name(for which screenshots are taking)/pdfprogramname-device-dateandtime.pdf


