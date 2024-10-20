import * as vscode from 'vscode';
import Groq from 'groq-sdk';
import * as path from 'path';
import * as fs from 'fs';

let groq: Groq | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('Simplicity extension is now active!');

  // Initialize the GROQ client
  initializeGroqClient(context);

  // Register the WebviewViewProvider
  const provider = new SimplicityViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SimplicityViewProvider.viewType, provider)
  );

  // Register the command
  let generateLearningFileCmd = vscode.commands.registerCommand('simplicity.generateLearningFile', async () => {
    await generateLearningFile();
  });

  context.subscriptions.push(generateLearningFileCmd);
}

function initializeGroqClient(context: vscode.ExtensionContext) {
  const configPath = path.join(context.extensionPath, 'config.json');

  if (!fs.existsSync(configPath)) {
    vscode.window.showErrorMessage('config.json file not found. Please create a config.json file with your GROQ API key.');
    return;
  }

  let config: any;
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configContent);
  } catch (error) {
    vscode.window.showErrorMessage('Failed to read config.json. Please ensure it is valid JSON.');
    return;
  }

  const groqApiKey = config.groqApiKey;
  if (!groqApiKey) {
    vscode.window.showErrorMessage('GROQ API Key is not set in config.json. Please add your API key.');
    return;
  }

  groq = new Groq({
    apiKey: groqApiKey,
  });
}

class SimplicityViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplicityView';
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {
    // GROQ client is already initialized globally
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'processInput':
          await this.processInput(message.text);
          break;
        case 'processFile':
          await this.processFile(message.fileData);
          break;
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js')
    );

    const nonce = getNonce();

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Simplicity</title>
      </head>
      <body>
        <h2>Simplicity</h2>
        <div>
          <textarea id="textInput" rows="10" cols="30" placeholder="Enter text here"></textarea>
          <br>
          <button id="submitText">Submit Text</button>
        </div>
        <br>
        <div>
          <input type="file" id="fileInput" accept=".pdf">
          <br>
          <button id="submitFile">Upload PDF</button>
        </div>

        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>
    `;
    return html;
  }

  private async processInput(text: string) {
    const detectedLanguage = await detectProgrammingLanguage(text);
    if (detectedLanguage) {
      await generateLearningFile(detectedLanguage);
    } else {
      vscode.window.showErrorMessage('Could not detect programming language from the input text.');
    }
  }

  private async processFile(fileData: ArrayBuffer) {
    const text = await extractTextFromPDF(fileData);
    if (text) {
      const detectedLanguage = await detectProgrammingLanguage(text);
      if (detectedLanguage) {
        await generateLearningFile(detectedLanguage);
      } else {
        vscode.window.showErrorMessage('Could not detect programming language from the PDF.');
      }
    } else {
      vscode.window.showErrorMessage('Failed to extract text from the PDF.');
    }
  }
}

async function generateLearningFile(language?: string) {
  if (!groq) {
    vscode.window.showErrorMessage('GROQ client is not initialized. Please ensure your API key is set in config.json.');
    return;
  }

  // If language is not provided, prompt the user
  if (!language) {
    language = await vscode.window.showInputBox({
      prompt: 'Enter the programming language you want to learn',
      placeHolder: 'e.g., Python, JavaScript, C++',
      validateInput: (text) => {
        return text ? null : 'Please enter a programming language';
      },
    });

    if (!language) {
      vscode.window.showWarningMessage('No language was entered.');
      return;
    }
  }

  const content = await generateCodeContent(language);

  if (!content) {
    vscode.window.showErrorMessage('Failed to generate the learning file.');
    return;
  }

  const doc = await vscode.workspace.openTextDocument({
    content,
    language: getLanguageId(language),
  });

  await vscode.window.showTextDocument(doc);
}

async function generateCodeContent(language: string): Promise<string | null> {
  if (!groq) {
    vscode.window.showErrorMessage('GROQ client is not initialized.');
    return null;
  }

  try {
    const messages: any = [
      {
        role: 'system',
        content: `You are a helpful assistant that creates project-based, hands-on learning plans in ${language}. The learning 
        plan should start with very easy concepts and progress to advanced topics over at least 10 milestones. Do not 
        generate any code. Focus only on providing comments and instructions to the user on what to do at each milestone. 
        Add hints if needed. The goal is to guide the user through projects that enhance their understanding step by step.`,
      },
      {
        role: 'user',
        content: `Create a detailed, project-based learning plan in ${language} with at least 10 milestones. 
        Each milestone should include clear instructions, objectives, and hints if necessary. Focus on comments and 
        guidance without providing actual code. Start from the basics and progressively cover more advanced topics, culminating 
        in a specific, comprehensive project that you feel will help the user understand the concepts previously covered.`,
      },
    ];

    const response = await groq.chat.completions.create({
      model: 'llama3-groq-8b-8192-tool-use-preview',
      messages: messages,
      temperature: 0.5,
      max_tokens: 1500,
      top_p: 1,
      stop: null,
      stream: false,
    });

    if (response.choices && response.choices.length > 0) {
      const messageContent = response.choices[0]?.message?.content;
      return messageContent ? messageContent.trim() : null;
    } else {
      vscode.window.showErrorMessage('No content received from GROQ.');
      return null;
    }
  } catch (error: any) {
    console.error('Error generating code content:', error);

    if (error.response && error.response.data && error.response.data.error) {
      vscode.window.showErrorMessage(`GROQ API Error: ${error.response.data.error.message}`);
    } else {
      vscode.window.showErrorMessage(`An error occurred: ${error.message}`);
    }

    return null;
  }
}

async function extractTextFromPDF(fileData: ArrayBuffer): Promise<string | null> {
  // Implement or handle PDF extraction
  // Note: As mentioned earlier, this may not work due to environment limitations
  return null;
}

async function detectProgrammingLanguage(text: string): Promise<string | null> {
  const patterns: { [key: string]: RegExp } = {
    Python: /import\s+|def\s+|print\(|#/,
    JavaScript: /function\s+|console\.log\(|var\s+|let\s+|const\s+|\/\//,
    // Add more patterns for other languages
  };

  for (const [language, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return language;
    }
  }
  return null;
}

function getLanguageId(language: string): string {
  const languageMap: { [key: string]: string } = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    'c++': 'cpp',
    c: 'c',
    java: 'java',
    'c#': 'csharp',
    ruby: 'ruby',
    php: 'php',
    go: 'go',
    swift: 'swift',
    scala: 'scala',
    rust: 'rust',
    kotlin: 'kotlin',
    perl: 'perl',
    r: 'r',
  };

  return languageMap[language.toLowerCase()] || '';
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function deactivate() {}
