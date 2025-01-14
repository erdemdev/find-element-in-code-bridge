import * as vscode from "vscode";
import express, { Request, Response, NextFunction } from "express";

const EXTENSION_NAME = "Find Element in Code";
let server: any;
const PORT = 12800;
let statusBarItem: vscode.StatusBarItem;

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

  app.use(express.text({ type: "*/*" }));

  app.post("/", async (req: Request, res: Response) => {
    const body = req.body;

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
      "**/*.{tsx,jsx,html}",
      "**/node_modules/**",
    );

    let foundFile: vscode.Uri | undefined;
    let lineNumber: number = 0;
    let columnNumber: number = 0;

    const regex = new RegExp(body);

    // Search for content in each file
    for (const file of files) {
      const content = await readFileContent(file.fsPath);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const match = regex.exec(lines[i]);
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

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if workspace is open
    if (!vscode.workspace.workspaceFolders) {
      const msg = `[${EXTENSION_NAME}] No workspace is open. The extension will be disabled until you open a workspace.`;
      vscode.window.showWarningMessage(msg);
      updateStatusBar("error");
      reject(new Error(msg));
      return;
    }

    const app = createServer();

    server = app
      .listen(PORT, () => {
        console.log(
          `[${EXTENSION_NAME}] Server started on port ${PORT}`,
        );
        updateStatusBar("running");
        resolve();
      })
      .on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          const msg = `[${EXTENSION_NAME}] Port ${PORT} is already in use. Please make sure no other instance of the extension is running.`;
          vscode.window.showErrorMessage(msg);
          updateStatusBar("error");
          server = null;
          reject(new Error(msg));
        } else {
          const msg = `[${EXTENSION_NAME}] Failed to start server: ${error.message}`;
          vscode.window.showErrorMessage(msg);
          updateStatusBar("error");
          server = null;
          reject(new Error(msg));
        }
      });
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        updateStatusBar("stopped");
        resolve();
      });
    } else {
      updateStatusBar("stopped");
      resolve();
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  // Create status bar item
  statusBarItem = createStatusBarItem();
  updateStatusBar("stopped"); // Set initial state as stopped
  context.subscriptions.push(statusBarItem);

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
