import * as vscode from 'vscode';
import Groq from 'groq-sdk';
import * as path from 'path';
import * as fs from 'fs';

let groq: Groq | null = null;
let milestoneCounter = 1;  // Milestone counter, reset on extension restart
let inferredLanguage: string | null = null;  // Store inferred language globally

export function activate(context: vscode.ExtensionContext) {
  console.log('Simplicity extension is now active!');

  // Initialize Groq client using config.json
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

  groq = new Groq({ apiKey: groqApiKey });

  // Register command for initializing the learning path
  let initLearningPathCmd = vscode.commands.registerCommand('simplicity.initLearningPath', async () => {
    milestoneCounter = 1; // Reset milestone counter on new start
    await initializeLearningPath();
  });

  // Register command for evaluating the user's solution
  let evaluateUserCodeCmd = vscode.commands.registerCommand('simplicity.evaluateUserCode', async () => {
    await evaluateUserCode();
  });

  context.subscriptions.push(initLearningPathCmd, evaluateUserCodeCmd);
}

// Initialize learning path based on user prompt
async function initializeLearningPath() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder in the workspace.');
    return;
  }

  // Prompt for the learning goal or topic in natural language
  const userPrompt = await vscode.window.showInputBox({
    prompt: 'What would you like to learn? Describe your goal.',
    placeHolder: 'e.g., I want to learn how to build a web scraper.',
    validateInput: (text) => {
      return text ? null : 'Please enter a goal or topic.';
    },
  });

  if (!userPrompt) {
    vscode.window.showWarningMessage('No input was entered.');
    return;
  }

  // Infer the programming language from the user prompt
  inferredLanguage = await inferLanguageFromPrompt(userPrompt);  // Store the inferred language globally

  // Generate the first milestone based on the inferred language and user-provided topic
  await generateMilestone(inferredLanguage, milestoneCounter, userPrompt);
}

// Infer the programming language from the user's prompt using Groq
async function inferLanguageFromPrompt(prompt: string): Promise<string> {
  try {
    const messages = [
      { role: 'user', content: `Analyze this prompt and determine the programming language being referenced or implied: ${prompt}. With nothing else, just response with the one word name of the language BY ITSELF (e.g. c) or, if none is able to be determined, just responsd with "python".` }
    ];

    const response = await groq?.chat.completions.create({
      model: 'llama3-groq-8b-8192-tool-use-preview',
      messages: messages as any,
      temperature: 0.0, // Deterministic response
      max_tokens: 500,
    });
    if (response?.choices && response.choices.length > 0) {
      const inferredLanguage = response.choices[0]?.message?.content?.trim().toLowerCase();
      console.log(`Inferred language: ${inferredLanguage}`);
      return inferredLanguage || 'python';
    }
    return 'python'; // Default to Python if language cannot be determined
  } catch (error) {
    console.error('Error inferring language from prompt:', error);
    return 'python'; // Fallback to Python
  }
}

// Generate or update the milestone in `playground.[extension]`
async function generateMilestone(language: string, milestoneNumber: number, topic: string) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder in the workspace.');
    return;
  }

  // Generate content from Groq, passing the user topic for the milestone creation
  const milestoneContent = await generateMilestoneContent(language, milestoneNumber, topic);
  if (!milestoneContent) {
    vscode.window.showErrorMessage('Failed to generate the milestone.');
    return;
  }

  // Ensure the correct extension is used based on the inferred language
  const extension = getFileExtension(language) || 'py'; // Default to 'py' if language can't be determined
  const fileName = `playground.${extension}`;
  const filePath = path.join(workspaceFolder.uri.fsPath, fileName);
  const fileUri = vscode.Uri.file(filePath);

  // Comment out the content using language-specific syntax
  const commentedContent = commentOutContent(milestoneContent, language);

  try {
    // Delete the old file first before generating a new one
    await Promise.resolve(vscode.workspace.fs.delete(fileUri, { useTrash: false })).catch(() => {
      console.log(`File does not exist: ${fileName}, skipping deletion.`);
    });

    // Write the new milestone content to the playground file
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(commentedContent, 'utf8'));

    // Open the new file
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document);
  } catch (error) {
    vscode.window.showErrorMessage('Failed to create or open the playground file.');
    console.error('Error creating or opening file:', error);
  }
}

// Generate milestone content from Groq
async function generateMilestoneContent(language: string, milestoneNumber: number, topic: string): Promise<string | null> {
  try {
    const messages: any = [
      {
        role: 'system',
        content: `You are an assistant that generates programming milestones (similar to LeetCode questions) in
            order to help users learn the following: ${topic}. Here is the specified language: ${language}. If a language is not 
            specified, default to Python.
            Each milestone consists of:
            1. A brief problem description.
            2. A single function signature.
            3. 3–5 test cases, including edge cases.
            Milestone difficulty increases with each milestone number. For example, Milestone 1 should start with 
            basic input handling, and Milestone ${milestoneNumber} should be more difficult, requiring loops, data
             structures, etc. The difficulty increases with each milestone. Do not at any point include the solution.
            `,
      },
      {
        role: 'user',
        content: `Generate milestone ${milestoneNumber} in ${language}. Ensure it starts easy and progressively
             gets harder, with a clear increase in difficulty tied to the milestone number. Format it with comments.`,
      },
    ];

    if (!groq) {
      vscode.window.showErrorMessage('Groq client is not initialized.');
      return null;
    }
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
      const choice = response.choices?.[0]?.message?.content;
      return choice ? choice.trim() : null;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error generating milestone content:', error);
    return null;
  }
}

// Evaluate the user's code using Groq
async function evaluateUserCode() {
  console.log('Evaluate User Code command triggered!');

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found.');
    console.log('No active editor found.');
    return;
  }

  const userCode = editor.document.getText();
  console.log('User code:', userCode);

  const evaluationResult = await evaluateWithGroq(userCode);
  if (evaluationResult === 'PASS') {
    console.log('User code passed the test cases.');
    vscode.window.showInformationMessage('Your code passed the test cases!');

    // Increment the milestone number and generate the next milestone
    milestoneCounter++;
    await generateMilestone(inferredLanguage || getLanguageFromFileName(editor.document.fileName), milestoneCounter, "Next topic or user input");
  } else {
    console.log('User code failed the test cases.');
    vscode.window.showErrorMessage('Your code is incorrect. Please try again.');
  }
}

// Function to send the user's code to Groq for evaluation
async function evaluateWithGroq(userCode: string): Promise<string> {
  try {
    if (!groq) {
      vscode.window.showErrorMessage('Groq client is not initialized.');
      return 'FAIL';
    }
    const response = await groq.chat.completions.create({
      model: 'llama3-groq-8b-8192-tool-use-preview',
      messages: [
        { role: 'user', content: `Evaluate this code and return ONLY PASS or FAIL, nothing else.: \n${userCode}` }
      ],
      temperature: 0.0,  // Keep the response deterministic
      max_tokens: 10,
    });

    if (response.choices && response.choices.length > 0) {
      const evaluation = response.choices[0]?.message?.content?.trim();
      console.log('Evaluation result:', evaluation);
      return evaluation === 'PASS' ? 'PASS' : 'FAIL';
    }
    return 'FAIL';
  } catch (error) {
    console.error('Error during code evaluation with Groq:', error);
    return 'FAIL';
  }
}

// Extract language from filename
function getLanguageFromFileName(fileName: string): string {
  const ext = path.extname(fileName).substring(1);
  return ext === 'py' ? 'python' : ext === 'js' ? 'javascript' : ext;
}

// Get the appropriate file extension based on the language
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

  return languageMap[language.toLowerCase()] || 'py';  // Default to 'py' if not found
}

// Comment out the content using language-specific syntax
function commentOutContent(content: string, language: string): string {
  const commentSyntax = getCommentSyntax(language);
  return content.split('\n').map(line => `${commentSyntax} ${line}`).join('\n');
}

// Map language to appropriate comment syntax
function getCommentSyntax(language: string): string {
  const syntaxMap: { [key: string]: string } = {
    python: '#',
    javascript: '//',
    typescript: '//',
    'c++': '//',
    c: '//',
    java: '//',
    'c#': '//',
    ruby: '#',
    php: '//',
    go: '//',
    swift: '//',
    scala: '//',
    rust: '//',
    kotlin: '//',
    perl: '#',
    r: '#',
  };
  return syntaxMap[language.toLowerCase()] || '#';  // Default to '#' if not found
}

export function deactivate() { }
