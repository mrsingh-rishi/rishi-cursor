"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const openai_1 = __importDefault(require("openai"));
const diff_1 = require("diff");
const router = (0, express_1.Router)();
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
router.post('/iterate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
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
        const chat = yield openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ]
        });
        const content = (_b = (_a = chat.choices[0].message) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : '';
        // 3. Parse JSON safely
        const parsed = JSON.parse(content);
        const { revisedCode, explanation } = parsed;
        // 4. Generate a diff (optional)
        const diff = (0, diff_1.diffLines)(code, revisedCode)
            .map((part) => (part.added ? '+ ' : part.removed ? '- ' : '  ') + part.value)
            .join('');
        // 5. Return
        res.json({ revisedCode, explanation, diff });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'AI iteration failed.' });
    }
}));
exports.default = router;
