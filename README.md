# Simplicity Extension for VS Code

Simplicity is an intelligent, project-based learning platform built directly into Visual Studio Code. It allows users to automatically generate personalized, hands-on learning plans for various programming languages. With milestone-driven progress, each step is presented as a commented-out instructional guide inside a generated playground file, making it easy to learn or deepen expertise without leaving the coding environment.

## Features

- Automatically generates learning plans based on user-defined goals.
- Supports multiple programming languages with smart inference from user prompts.
- Provides milestone-based challenges that increase in difficulty.
- Allows code evaluation and feedback directly in the playground file.
- Offers an additional feature to generate detailed explanations of topics or code snippets.

## Table of Contents

- [Setup](#setup)
- [Prerequisites](#prerequisites)
- [Configuring the Extension](#configuring-the-extension)
- [Usage](#usage)
- [Commands](#commands)
- [Technologies Used](#technologies-used)
- [How it Works](#how-it-works)

## Setup

### Prerequisites

Before using Simplicity, ensure you have the following installed:

- Node.js (v14 or higher)
- npm
- Visual Studio Code (v1.60.0 or higher)

### Configuring the Extension

1. Clone the repository:

```bash
https://github.com/vishruthb/simplicity/
cd simplicity
```

2. Create the `config.json` file:
{
  "groqApiKey": "<YOUR_GROQ_API_KEY>"
}

3. Install dependencies: `npm install`

4. Compile typescript to check for any errors: `npm run compile`

## Usage

### Commands

All interactions with the Simplicity extension are done via the Visual Studio Code Command Palette (`Ctrl + Shift + P` or `Cmd + Shift + P` on macOS). Below are the available commands:

- Simplicity: Initialize Learning Path
     - Starts the learning plan creation process.
- Simplicity: Validate User Code
    - Evaluates your code to see if it passes the current milestone’s test cases.
- Simplicity: Explain Topic
    - Generates a Markdown file that explains a programming topic or code snippet.

### Learning Path Workflow
1. Initialize Learning Path:
- Use `Simplicity: Initialize Learning Path` from the Command Palette.
- You will be prompted to describe what you'd like to learn, such as:
    - "Learning object-oriented programming in Java"
    - "Master data structures in Python"
Based on your prompt, Simplicity will infer the programming language and create the first milestone in a playground file (`playground.<language>`). Each milestone is a mini-task that helps you work towards your goal.

2. Work through Milestones:
- Each milestone is a new challenge or task that builds on the previous one.
- The playground file will contain commented-out instructions, including:
    - A problem description
    - Function signatures to implement
    - Test cases to pass

3. Evaluate Your Code:
- After completing the task in the playground file, use the `Simplicity: Validate User Code` command to check if your solution works.
- If successful, the next milestone will be automatically generated.
- If not, you’ll receive feedback to help debug your solution.

### Explanation Workflow
- Explain a Topic:
    - Use the `Simplicity: Explain Topic` command.
    - Enter a programming topic or code snippet that you want to understand better (e.g., "recursion in Python" or "how to use promises in JavaScript").
    - Simplicity will generate a detailed Markdown (.md) file with a concise explanation, a simple example, and a more advanced example. The examples are designed to teach the topic progressively.

## How it Works
### Intelligent Project-Based Learning
Simplicity’s core feature is its intelligent learning path generation. It creates personalized learning plans for various programming topics by:
- Understanding User Goals: You enter a natural-language prompt, and the extension uses Groq to infer the appropriate language and create milestones.
- Step-by-Step Progress: Milestones are designed to increase in difficulty, guiding users from beginner-level tasks to more complex challenges. Each task is provided with clear instructions, function signatures, and test cases.
- Adaptive Learning Experience: With all milestones and evaluations occurring within the VS Code playground file, users never have to leave their development environment to learn.

### Developer Tool Integration
Simplicity is designed as a developer tool for learning new languages or sharpening existing skills directly in VS Code. It integrates deeply with the IDE:
- Command Palette Integration: All interactions are done via the command palette, keeping the workflow simple and IDE-centric.
- Real-Time Code Evaluation: Once you’ve completed a milestone task, you can immediately test your solution by running the `Simplicity: Validate User Code` command, providing immediate feedback.
- Markdown Documentation: The `Explain Topic` command generates Markdown files, which are easy to read, edit, and share.