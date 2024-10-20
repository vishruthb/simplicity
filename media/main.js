const vscode = acquireVsCodeApi();

document.getElementById('submitText').addEventListener('click', () => {
  const text = document.getElementById('textInput').value;
  vscode.postMessage({ command: 'processInput', text });
});

document.getElementById('submitFile').addEventListener('click', () => {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target.result;
      vscode.postMessage({ command: 'processFile', fileData });
    };
    reader.readAsArrayBuffer(file);
  }
});
