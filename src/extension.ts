import * as vscode from 'vscode';
import Groq from 'groq-sdk';
import * as path from 'path';
import * as fs from 'fs';

let groq: Groq | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('Simplicity extension is now active!');

  // Determine the path to the config.json file
  const configPath = path.join(context.extensionPath, 'config.json');

  // Check if the config.json file exists
  if (!fs.existsSync(configPath)) {
    vscode.window.showErrorMessage('config.json file not found. Please create a config.json file with your GROQ API key.');
    return;
  }

  // Read the config.json file
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

  let generateLearningFileCmd = vscode.commands.registerCommand('simplicity.generateLearningFile', async () => {
    await generateLearningFile();
  });

  context.subscriptions.push(generateLearningFileCmd);
}

async function generateLearningFile() {
  // Step 1: Prompt for the programming language
  const language = await vscode.window.showInputBox({
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

  // Step 2: Generate the code content using GROQ
  const content = await generateCodeContent(language);

  if (!content) {
    vscode.window.showErrorMessage('Failed to generate the learning file.');
    return;
  }

  // Step 3: Get the workspace folder and create a directory for simplicity-learning-env
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder in the workspace.');
    console.log('No workspace folder detected');
    return;
  }

  // Log workspace folder details for debugging
  console.log('Workspace folder:', workspaceFolder.uri.fsPath);

  // Create the new directory path
  const folderName = 'simplicity-learning-env';
  const folderPath = path.join(workspaceFolder.uri.fsPath, folderName);

  try {
    // Create the directory if it doesn't exist
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(folderPath));
    console.log('Directory created:', folderPath);
  } catch (error) {
    vscode.window.showErrorMessage('Failed to create simplicity-learning-env folder.');
    console.error('Error creating directory:', error);
    return;
  }

  // Determine the file extension based on the language
  const extension = getFileExtension(language);
  const fileName = `playground.${extension}`;
  const filePath = path.join(folderPath, fileName);
  const fileUri = vscode.Uri.file(filePath);

  try {
    // Write content to the new file
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
    console.log('File created:', filePath);

    // Open the newly created file in VS Code
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document);

    // Reveal the directory in VS Code's explorer
    vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folderPath), {
      forceNewWindow: false
    });
  } catch (error) {
    vscode.window.showErrorMessage('Failed to create or open file in simplicity-learning-env.');
    console.error('Error creating or opening file:', error);
  }
}

async function generateCodeContent(language: string): Promise<string | null> {
  try {
    if (!groq) {
      vscode.window.showErrorMessage('GROQ client is not initialized.');
      return null;
    }

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

function getFileExtension(language: string): string {
  const languageMap: { [key: string]: string } = {
    python: 'py',
    javascript: 'js',
    typescript: 'ts',
    'c++': 'cpp',
    c: 'c',
    java: 'java',
    'c#': 'cs',
    ruby: 'rb',
    php: 'php',
    go: 'go',
    swift: 'swift',
    scala: 'scala',
    rust: 'rs',
    kotlin: 'kt',
    perl: 'pl',
    r: 'r',
  };

  return languageMap[language.toLowerCase()] || 'txt';  // Default to 'txt' if language not found
}

export function deactivate() {}
