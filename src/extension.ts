import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const provider = new SimplicityViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SimplicityViewProvider.viewType,
      provider
    )
  );

  console.log('Minimal Simplicity extension activated');
}

class SimplicityViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplicityView';

  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {
    console.log('SimplicityViewProvider constructor called');
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('resolveWebviewView called');
    this._view = webviewView;

    // Set the HTML content for the webview
    webviewView.webview.html = this.getHtmlForWebview();
  }

  private getHtmlForWebview(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Simplicity View</title>
      </head>
      <body>
        <h1>Hello from Simplicity View!</h1>
      </body>
      </html>`;
  }
}

export function deactivate() {}