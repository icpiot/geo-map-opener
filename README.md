# Geo Map Opener - Smart Context-Menu Mode

Highlight latitude then longitude (or vice-versa), choose **Use as Geo Coordinate** and the extension opens Google Maps automatically.

## What it does
Highlight latitude then longitude (or vice-versa), right-click **Use as Geo Coordinate**.
When the second number is captured the extension opens Google Maps at that point.

## Developer install
1. Clone this repo
2. In Edge/Chrome go to `edge://extensions` (`chrome://extensions`)
3. Enable **Developer mode** -> **Load unpacked** -> select this folder

## Build a CRX for side-loading
1. Open `edge://extensions` with Developer mode on
2. Click **Pack extension** -> choose this folder
3. Edge creates `geo-map-opener.crx` and a private key `.pem`
   _Keep the `.pem` safe and reuse it for future updates._

## Permissions
* `contextMenus` - adds the right-click menu
* `tabs` - opens Google Maps in a new tab

> No data leaves the browser; everything stays local.
