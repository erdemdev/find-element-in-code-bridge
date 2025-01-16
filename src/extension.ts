import * as vscode from "vscode";
import express, { Request, Response, NextFunction } from "express";

const EXTENSION_NAME = "Find Element in Code";
let server: any;
const PORT = 12800;
let statusBarItem: vscode.StatusBarItem;
let globalContext: vscode.ExtensionContext;

const SERVER_STATE_KEY = 'serverState';

interface ServerState {
  isRunning: boolean;
  lastStatus: 'running' | 'stopped' | 'error';
}

function createStatusBarItem() {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "find-element-in-code-bridge.toggleServer";
  return statusBarItem;
}

function updateStatusBar(status: "running" | "stopped" | "error") {
  if (!statusBarItem) {
    statusBarItem = createStatusBarItem();
  }

  switch (status) {
    case "running":
      statusBarItem.text = "$(radio-tower) FEIC connected";
      statusBarItem.tooltip = `Server is running on port ${PORT}. Click to stop.`;
      statusBarItem.backgroundColor = undefined;
      break;
    case "stopped":
      statusBarItem.text = "$(circle-slash) FEIC disconnected";
      statusBarItem.tooltip = "Server is stopped. Click to start.";
      statusBarItem.backgroundColor = undefined;
      break;
    case "error":
      statusBarItem.text = "$(error) FEIC errored";
      statusBarItem.tooltip =
        "Server encountered an error. Click to retry.";
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
      break;
  }

  statusBarItem.show();
}

async function readFileContent(filePath: string): Promise<string> {
  try {
    const readData = await vscode.workspace.fs.readFile(
      vscode.Uri.file(filePath),
    );
    return Buffer.from(readData).toString("utf8");
  } catch (error) {
    console.error(
      `[${EXTENSION_NAME}] Error reading file ${filePath}:`,
      error,
    );
    return "";
  }
}

function createServer() {
  const app = express();

  // Add CORS headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS",
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.use(express.json());

  app.post("/", async (req: Request, res: Response) => {
    const { regex, fileTypes } = req.body;

    if (!regex || !Array.isArray(fileTypes)) {
      res.status(400).json({ error: "Invalid request body. Expected 'regex' and 'fileTypes' array fields." });
      return;
    }

    // Get all files in the workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      const msg = `[${EXTENSION_NAME}] No workspace is open. The extension will be disabled until you open a workspace.`;
      vscode.window.showWarningMessage(msg);
      updateStatusBar("error");
      return;
    }

    // Get all the related files.
    const files = await vscode.workspace.findFiles(
      `**/*.{${fileTypes.join(',')}}`,
      "**/node_modules/**",
    );

    let foundFile: vscode.Uri | undefined;
    let lineNumber: number = 0;
    let columnNumber: number = 0;

    const regexPattern = new RegExp(regex);

    // Search for content in each file
    for (const file of files) {
      const content = await readFileContent(file.fsPath);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const match = regexPattern.exec(lines[i]);
        if (match) {
          foundFile = file;
          lineNumber = i + 1; // Convert to 1-based line number
          columnNumber = match.index + 1; // Convert to 1-based column number
          break;
        }
      }

      if (foundFile) {
        break;
      }
    }

    if (foundFile) {
      res.json({
        status: "success",
        path: `${foundFile.path}:${lineNumber}:${columnNumber}`,
      });
    } else {
      res.json({ status: "notFound" });
    }
  });

  return app;
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tempServer = require('net').createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        tempServer.once('close', () => {
          resolve(true);
        }).close();
      })
      .listen(port);
  });
}

async function startServer(): Promise<void> {
  try {
    // Check if port is available before attempting to start
    const portAvailable = await isPortAvailable(PORT);
    if (!portAvailable) {
      console.error(`[${EXTENSION_NAME}] Port ${PORT} is not available`);
      updateStatusBar("error");
      const serverState: ServerState = { isRunning: false, lastStatus: 'error' };
      globalContext.workspaceState.update(SERVER_STATE_KEY, serverState);
      return;
    }

    const app = createServer();
    server = app.listen(PORT);
    
    server.on('error', (error: any) => {
      console.error(`[${EXTENSION_NAME}] Server error:`, error);
      updateStatusBar("error");
      const serverState: ServerState = { isRunning: false, lastStatus: 'error' };
      globalContext.workspaceState.update(SERVER_STATE_KEY, serverState);
    });

    server.on('listening', () => {
      console.log(`[${EXTENSION_NAME}] Server is running on port ${PORT}`);
      updateStatusBar("running");
      const serverState: ServerState = { isRunning: true, lastStatus: 'running' };
      globalContext.workspaceState.update(SERVER_STATE_KEY, serverState);
    });
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] Failed to create server:`, error);
    updateStatusBar("error");
    const serverState: ServerState = { isRunning: false, lastStatus: 'error' };
    globalContext.workspaceState.update(SERVER_STATE_KEY, serverState);
  }
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log(`[${EXTENSION_NAME}] Server stopped`);
        updateStatusBar("stopped");
        // Save server state
        const serverState: ServerState = { isRunning: false, lastStatus: 'stopped' };
        globalContext.workspaceState.update(SERVER_STATE_KEY, serverState);
        server = null; // Clear the server variable after stopping
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  globalContext = context;
  
  // Create status bar item
  statusBarItem = createStatusBarItem();
  updateStatusBar("stopped"); // Set initial state as stopped
  context.subscriptions.push(statusBarItem);

  // Restore server state with port check
  const serverState = context.workspaceState.get<ServerState>(SERVER_STATE_KEY);
  if (serverState?.isRunning) {
    // Check if port is actually available before attempting to restore
    isPortAvailable(PORT).then(available => {
      if (available) {
        startServer();
      } else {
        // Update state to error if port is not available
        updateStatusBar("error");
        const serverState: ServerState = { isRunning: false, lastStatus: 'error' };
        globalContext.workspaceState.update(SERVER_STATE_KEY, serverState);
      }
    });
  } else {
    updateStatusBar("stopped");
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "find-element-in-code-bridge.toggleServer",
      async () => {
        try {
          if (server) {
            await stopServer();
          } else {
            await startServer();
          }
        } catch (error) {
          console.error(
            `[${EXTENSION_NAME}] Failed to toggle server:`,
            error,
          );
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "find-element-in-code-bridge.startServer",
      async () => {
        try {
          await startServer();
        } catch (error) {
          console.error("Failed to start server:", error);
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "find-element-in-code-bridge.stopServer",
      async () => {
        try {
          await stopServer();
        } catch (error) {
          console.error("Failed to stop server:", error);
        }
      },
    ),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  return stopServer();
}
