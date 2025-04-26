import { Request, Response } from 'express';
import OpenAI from 'openai';
import { diffLines, Change } from 'diff';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// 1. Define and validate the incoming request shape
/**
 * Schema for validating the input to the generateCode function.
 * It ensures that the required fields are present and have valid values.
 *
 * @property {string} code - The original code to be revised.
 * @property {string} instruction - The instruction for revising the code.
 * @property {string} language - The programming language of the code (default: 'JavaScript').
 * @property {string} model - The OpenAI model to use (default: 'gpt-4o-mini').
 */
const GenerateCodeSchema = z.object({
  code: z.string().min(1, '`code` is required'),
  instruction: z.string().min(1, '`instruction` is required'),
  language: z.string().min(1).default('JavaScript'),
  model: z.string().default('gpt-4o-mini')
});
type GenerateCodeInput = z.infer<typeof GenerateCodeSchema>;

// 2. Define the response shape
interface GenerateCodeResponse {
  revisedCode: string;
  explanation: string[];
  diff: string;
  patch: string;
}

// 3. Utility to build a safe JSON prompt
/**
 * Constructs a prompt string for the OpenAI API based on the provided input.
 *
 * @param input - An object containing the code, instruction, language, and model.
 * @returns A formatted prompt string ready for the OpenAI API.
 */
function buildPrompt(input: GenerateCodeInput): string {
  return `
You are an expert ${input.language} engineer specializing in clean, maintainable code and game-dev workflows.

Original code:
\`\`\`${input.language}
${input.code}
\`\`\`

Task:
${input.instruction}

Reply with valid JSON only, no extra text:

{
  "revisedCode": "<the full revised code block>",
  "explanation": [
    "Bullet 1: What changed and why.",
    "Bullet 2: ..."
  ]
}
`;
}

// 4. Utility to generate a unified–style patch from diffLines
/**
 * Generates a patch string from an array of changes, creating a diff-like output
 * that distinguishes added and removed content.
 *
 * @param changes - An array of Change objects, each containing a value and flags 
 * indicating whether the change is an addition or removal.
 * @returns A string representing the unified diff patch constructed from the provided changes.
 */
function makePatch(changes: Change[]): string {
  let patch = '';
  let oldLine = 1;
  let newLine = 1;

  changes.forEach(part => {
    const lines = part.value.split('\n');
    const count = lines.length - 1;

    if (part.added) {
      patch += `@@ +${newLine},${count} @@\n`;
      lines.forEach(l => { if (l) patch += `+ ${l}\n`; });
      newLine += count;
    } else if (part.removed) {
      patch += `@@ -${oldLine},${count} @@\n`;
      lines.forEach(l => { if (l) patch += `- ${l}\n`; });
      oldLine += count;
    } else {
      oldLine += count;
      newLine += count;
    }
  });

  return patch;
}

// 5. The controller
/**
 * Handles a request to generate code based on provided instructions and existing code.
 *
 * This asynchronous function performs input validation using a schema, builds a prompt for OpenAI, and calls the OpenAI API to obtain a revised code snippet and an explanation.
 * It then computes a diff and patch between the original code and the revised code. The function returns a JSON response containing the revised code, its explanation, the diff, and the patch.
 *
 * @param req - The HTTP request object containing the request body which must include properties: code, instruction, language, and model.
 *              The request body is validated using GenerateCodeSchema.
 * @param res - The HTTP response object used to send the result back to the client.
 *
 * @throws Will send a 400 status response with validation error details if the input validation fails.
 * @throws Will send a 500 status response if there is an error during the OpenAI API call or if the JSON parsing of the AI response fails.
 *
 * @example
 * // Example usage in an Express route:
 * app.post('/generate-code', generateCode);
 */
export const generateCode = async (req: Request, res: Response) => {
  // Validate input
  const parseResult = GenerateCodeSchema.safeParse(req.body);
  if (!parseResult.success) {
    // Log the error details
    console.error('Validation error', parseResult.error.errors);
    res.status(400).json({ error: 'Invalid input', details: parseResult.error.errors });

    return;
  }
  const { code, instruction, language, model } = parseResult.data;

  try {
    // Build prompt
    const prompt = buildPrompt({ code, instruction, language, model });

    // Call OpenAI
    const completion = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
      .chat.completions.create({
        model,
        messages: [
          { role: 'system', content: `You are an AI code assistant.` },
          { role: 'user', content: prompt }
        ]
      });

    const content = completion.choices[0].message?.content?.trim() || '';
    let parsed: { revisedCode: string; explanation: string[] };

    // Parse JSON safely
    try {
      parsed = JSON.parse(content);
    } catch (jsonErr) {
      console.error('JSON parse error', jsonErr);
      throw new Error('AI returned invalid JSON.');
    }

    // Generate diff & patch
    const changes = diffLines(code, parsed.revisedCode);
    const diff = changes
      .map(c => (c.added ? '+ ' : c.removed ? '- ' : '  ') + c.value)
      .join('');
    const patch = makePatch(changes);

    const response: GenerateCodeResponse = {
      revisedCode: parsed.revisedCode,
      explanation: parsed.explanation,
      diff,
      patch
    };

    res.json(response);
  } catch (err: any) {
    console.error('Error during OpenAI call', err);
    res.status(500).json({ error: err.message ?? 'Iteration failed' });
  }
};
