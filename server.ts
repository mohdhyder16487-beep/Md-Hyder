import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { streamText, convertToModelMessages, pipeUIMessageStreamToResponse, UIMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Chat endpoint
  app.post('/api/chat', async (req, res) => {
    const { messages }: { messages: UIMessage[] } = req.body;

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    try {
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'A valid list of messages is required.' });
      }

      // Filter out any empty placeholder messages to prevent model conversion errors
      const validMessages = messages.filter((m) => {
        if (!m) return false;
        if (m.parts && Array.isArray(m.parts) && m.parts.length > 0) return true;
        if (typeof (m as any).content === 'string' && (m as any).content.trim().length > 0) return true;
        return false;
      });

      if (validMessages.length === 0) {
        return res.status(400).json({ error: 'At least one message with content is required.' });
      }

      // Convert AI SDK message list to model messages
      const modelMessages = await convertToModelMessages(validMessages);

      // Read key from environment variable inside the handler, never in client code
      const lovableApiKey = process.env.LOVABLE_API_KEY;
      const geminiApiKey = process.env.GEMINI_API_KEY;

      let model;
      if (lovableApiKey) {
        // OpenAI-compatible responses endpoint behind Lovable AI Gateway
        const openai = createOpenAI({
          baseURL: 'https://ai.gateway.lovable.dev/v1',
          apiKey: lovableApiKey,
        });
        const modelName = process.env.LOVABLE_MODEL || 'google/gemini-2.5-flash';
        model = openai(modelName);
      } else if (geminiApiKey) {
        // Fallback for AI Studio preview environment when LOVABLE_API_KEY is not defined
        const google = createGoogleGenerativeAI({
          apiKey: geminiApiKey,
        });
        const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
        model = google(geminiModel);
      } else {
        return res.status(500).json({
          error: 'LOVABLE_API_KEY is not configured on the server.',
        });
      }

      const result = streamText({
        model,
        system:
          'You are Sage, a friendly, helpful AI assistant. Always reply in English. Answer clearly and concisely, using markdown when it helps.',
        messages: modelMessages,
        abortSignal: abortController.signal,
      });

      // Stream the reply back as a UI message stream with reasoning included
      pipeUIMessageStreamToResponse({
        response: res,
        stream: result.toUIMessageStream({
          sendReasoning: true,
          onError: (err) => {
            const message = err instanceof Error ? err.message : String(err || 'An error occurred.');
            console.warn('Stream processing warning:', message);
            return message;
          },
        }),
      });
    } catch (error: any) {
      if (abortController.signal.aborted) {
        return;
      }
      const message = error?.message || 'An error occurred while generating the reply.';
      console.warn('Chat request handling warning:', message);
      if (!res.headersSent) {
        res.status(500).json({
          error: message,
        });
      }
    }
  });

  // Serve static files or Vite dev middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Sage server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
