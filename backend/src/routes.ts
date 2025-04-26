import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { diffLines } from 'diff';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/iterate', async (req: Request, res: Response) => {
  const { code, instruction, language } = req.body;
  try {
    // 1. Build a strong prompt
    const system = `You are an expert ${language} developer.`;
    const user = `
Original code:
\`\`\`${language}
${code}
\`\`\`

Please: ${instruction}

Respond with valid JSON:
{
  "revisedCode": "<full revised code block>",
  "explanation": ["Change 1…", "Change 2…"]
}
    `;

    // 2. Call OpenAI
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    });
    const content = chat.choices[0].message?.content ?? '';
    
    // 3. Parse JSON safely
    const parsed = JSON.parse(content);
    const { revisedCode, explanation } = parsed;

    // 4. Generate a diff (optional)
    const diff = diffLines(code, revisedCode)
      .map((part: any) => (part.added ? '+ ' : part.removed ? '- ' : '  ') + part.value)
      .join('');

    // 5. Return
    res.json({ revisedCode, explanation, diff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI iteration failed.' });
  }
});

export default router;
