# Find Element In Code (Bridge)

This VS Code extension provides a bridge between your browser and VS Code, allowing you to quickly locate and open source code files containing specific elements from your web application.

## Features

- Creates a local server that listens for requests from your browser
- Searches through your workspace for specific code elements
- Automatically opens the file containing the searched element
- Provides visual feedback through VS Code notifications
- Supports multiple file types (`.tsx`, `.jsx`, `.html`)
- Status bar indicator shows server status and provides quick actions
- Seamless integration with the browser extension

### Status Bar Indicator

The extension adds a status bar item that shows the current server status:

- 📡 Running: Server is active and listening for requests
- ⭕ Stopped: Server is currently stopped
- ⚠️ Error: Server encountered an issue

Click the status bar item to:

- Restart the server when it's running
- Start the server when it's stopped
- Retry when there's an error

## Requirements

- Visual Studio Code version 1.94.0 or higher
- Node.js and npm installed on your system
- A workspace containing TypeScript/React or HTML files
- The extension only activates when a workspace with `.tsx`, `.jsx`, or `.html` files is open

## Installation

1. Install the extension through VS Code's Extensions marketplace
2. Open a workspace containing your web application files
3. The extension will automatically activate and start a local server on port 12800
4. Install the corresponding browser extension from Chrome Web Store to connect to this bridge

## Browser Extension Integration

The VS Code extension works in tandem with a dedicated browser extension:

- Chrome Web Store: [Find Element In Code](https://chrome.google.com/webstore/category/extensions) ⏳
- Allows element selection directly from your web application
- Sends element information securely to the VS Code extension
- Provides visual feedback when elements are found

## Usage

1. First time setup: Run the command `Find Element In Code: Start Server` from Command Palette (Ctrl+Shift+P) or click the status bar item
2. After initial setup, the extension will automatically start the server when you open this workspace
3. Navigate to your web application in the browser
4. Use the browser extension to select an element
5. The VS Code extension will automatically find and open the source file containing that element

### Server Management

The extension provides commands to manage the connection to the browser:

- `Find Element In Code: Toggle Server`: Starts or stops the server
- `Find Element In Code: Start Server`: Starts the local server
- `Find Element In Code: Stop Server`: Stops the server

You can access these commands through the Command Palette (Ctrl+Shift+P).

## Extension Settings

Currently, this extension doesn't add any configurable settings to VS Code.

## Limitations

- Server runs on a fixed port (12800)
- Currently limited to a single workspace.
- Element search might take longer in large codebases

## Release Notes

### 0.0.1

Initial release of Find Element In Code Bridge:

- Basic functionality to find elements in source code
- Express server implementation
- File search and open capabilities

---

## Contributing

The source code for this extension is available on [GitHub](https://github.com/erdemdev/find-element-in-code-bridge). Feel free to contribute by submitting issues or pull requests.

## License

This extension is licensed under the [MIT License](LICENSE).

Copyright (c) 2025 erdemdev

---

**Enjoy coding with Find Element In Code Bridge!**
