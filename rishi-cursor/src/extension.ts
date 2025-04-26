import * as vscode from 'vscode';
import("node-fetch");

export function activate(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(
    vscode.commands.registerCommand('codePilot.iterate', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return vscode.window.showWarningMessage('Open a file first.');
      }

      // 1. Get selected code
      const code = editor.document.getText(editor.selection);
      if (!code.trim()) {
        return vscode.window.showWarningMessage('Select some code to iterate.');
      }

      // 2. Ask for instruction
      const instruction = await vscode.window.showInputBox({
        prompt: 'Describe the change you want (e.g. “extract collision check to method”)'
      });
      if (!instruction) { return; }

      // 3. Detect language
      const lang = editor.document.languageId; // e.g. "csharp", "cpp", "javascript"

      // 4. Call backend
      const spinner = vscode.window.withProgress<{ revisedCode: string; explanation: string[] }>({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating AI suggestion…',
        cancellable: false
      }, async () => {
        const resp = await fetch('http://localhost:4000/api/iterate', {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ code, instruction, language: lang })
        });
        return resp.json() as Promise<{ revisedCode: string; explanation: string[] }>;
      });

      const { revisedCode, explanation } = await spinner;

      // 5. Replace selection
      editor.edit(eb => eb.replace(editor.selection, revisedCode));

      // 6. Show explanation
      vscode.window.showInformationMessage('AI made changes:');
      explanation.forEach(item =>
        vscode.window.showInformationMessage(`– ${item}`)
      );
    })
  );
}

export function deactivate() {}
