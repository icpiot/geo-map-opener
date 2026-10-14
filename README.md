# Geo Map Opener - Smart Context-Menu Mode

Right-click a latitude/longitude value and choose **Use as Geo Coordinate**. The extension looks for a nearby matching latitude/longitude pair and opens your selected map provider automatically.

The detector also recognizes decimal coordinates, degrees/minutes/seconds, degrees and decimal minutes, cardinal directions, `geo:` links, common map URLs, OpenStreetMap map fragments, and Geohack coordinate URLs in both decimal-cardinal and degrees/minutes/seconds forms. It can also use common HTML geotag metadata such as `geo.position`, `ICBM`, Geo microformats, and `GeoCoordinates`. Right-clicking a supported coordinate link parses the link URL directly.

## Map providers
The default provider is Google Maps. Open the extension's Options page to change it, or use **Use as Geo Coordinate in...** from the right-click menu for a one-time choice. Supported providers are Google Maps, OpenStreetMap, Bing Maps, Apple Maps, Waze, HERE WeGo, and MapQuest.

## What it does
Right-click a value in a coordinate field and the extension checks nearby labels, field names, and values for the matching latitude/longitude pair. This helps when a page contains multiple coordinate sets.

If the page does not expose useful labels, highlight the latitude and longitude separately and choose **Use as Geo Coordinate** for each one. The second number opens Google Maps.

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
* `tabs` - opens the selected map provider in a new tab
* `storage` - saves the selected default provider

The page helper only reads the local DOM around the right-clicked field. It does not send page data anywhere.

> No data leaves the browser; everything stays local.
