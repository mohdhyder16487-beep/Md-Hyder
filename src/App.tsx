/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, Square, RotateCcw, AlertCircle, ChevronDown, ChevronRight, Brain, RefreshCw } from 'lucide-react';

const SUGGESTIONS = [
  'Explain black holes simply',
  'Write a short birthday message',
  'Give me 3 healthy dinner ideas',
];

function getMessageText(message: UIMessage): string {
  if (message.parts && Array.isArray(message.parts)) {
    const textFromParts = message.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('');
    if (textFromParts) return textFromParts;
  }
  if (typeof (message as any).content === 'string') {
    return (message as any).content;
  }
  return '';
}

function getMessageReasoning(message: UIMessage): string {
  if (!message.parts || !Array.isArray(message.parts)) return '';
  return message.parts
    .filter((part: any) => part.type === 'reasoning')
    .map((part: any) => part.reasoning)
    .join('\n\n');
}

export default function App() {
  const { messages, sendMessage, stop, status, error, setMessages, clearError, regenerate } = useChat();
  const [input, setInput] = useState('');
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';
  const isBusy = isStreaming || isSubmitted;
  const hasError = Boolean(error) || status === 'error';

  // Auto-scroll to newest line as replies stream in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // Adjust textarea height dynamically
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, 44), 160);
    el.style.height = `${newHeight}px`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;

    if (hasError) {
      clearError();
    }

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }

    try {
      await sendMessage({ text: trimmed });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    if (isBusy) return;
    if (hasError) {
      clearError();
    }
    try {
      await sendMessage({ text: suggestion });
    } catch (err) {
      console.error('Failed to send suggestion:', err);
    }
  };

  const handleResetChat = () => {
    if (isStreaming) {
      stop();
    }
    clearError();
    setMessages([]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoning((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  let lastAssistantMessageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantMessageIndex = i;
      break;
    }
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground antialiased select-text">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-serif text-xl font-medium shadow-xs ring-2 ring-primary/15">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-lg font-semibold tracking-tight text-foreground">
                  Sage
                </h1>
                <span className="inline-block h-2 w-2 rounded-full bg-primary/70 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground font-sans">Your AI assistant</p>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleResetChat}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shadow-2xs"
              title="Start fresh conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New conversation</span>
            </button>
          )}
        </div>
      </header>

      {/* Scrollable Message Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          {/* Global Error Banner */}
          {hasError && (
            <div className="mb-6 w-full rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-destructive">
                    I'm sorry, Sage ran into an issue while generating that response.
                  </p>
                  <p className="mt-1 text-xs text-destructive/85">
                    {error?.message || 'An unexpected error occurred. Please try again.'}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        clearError();
                        regenerate?.();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-destructive text-destructive-foreground px-2.5 py-1 text-xs font-medium hover:bg-destructive/90 cursor-pointer shadow-2xs"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={() => clearError()}
                      className="text-xs font-medium text-destructive underline hover:opacity-80 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            /* Empty State */
            <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center text-center px-4">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary font-serif text-2xl font-bold ring-8 ring-primary/5">
                S
              </div>
              <h2 className="font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                How can I help today?
              </h2>
              <div className="mx-auto mt-4 mb-8 h-0.5 w-12 rounded-full bg-primary/30" />

              <div className="flex w-full max-w-md flex-col gap-2.5 sm:gap-3">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="group flex w-full items-center justify-between rounded-full border border-border bg-card px-5 py-3 text-sm text-foreground transition-all duration-150 hover:border-primary/40 hover:bg-muted hover:shadow-xs cursor-pointer text-left"
                  >
                    <span className="font-normal text-foreground group-hover:text-primary transition-colors">
                      {suggestion}
                    </span>
                    <ArrowUp className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:text-primary transition-all rotate-45" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List */
            <div className="flex flex-col space-y-6 pb-6">
              {messages.map((message, index) => {
                const isUser = message.role === 'user';
                const text = getMessageText(message);
                const reasoning = !isUser ? getMessageReasoning(message) : '';
                const isLastAssistantMessage = index === lastAssistantMessageIndex;
                const isStillStarting = isLastAssistantMessage && isStreaming && !text && !reasoning;

                if (isUser) {
                  return (
                    <div key={message.id || index} className="flex w-full justify-end">
                      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-sm sm:text-base leading-relaxed text-primary-foreground shadow-xs whitespace-pre-wrap break-words">
                        {text}
                      </div>
                    </div>
                  );
                }

                // Assistant Message
                return (
                  <div key={message.id || index} className="flex w-full items-start gap-3.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-primary font-serif font-bold text-xs shadow-2xs mt-0.5">
                      S
                    </div>
                    <div className="flex-1 overflow-hidden space-y-2">
                      {/* Optional Reasoning block if present */}
                      {reasoning && (
                        <div className="rounded-lg border border-border bg-card/60 p-2.5 text-xs text-muted-foreground">
                          <button
                            type="button"
                            onClick={() => toggleReasoning(message.id || String(index))}
                            className="flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            <Brain className="h-3.5 w-3.5 text-primary/70" />
                            <span>Thought process</span>
                            {expandedReasoning[message.id || String(index)] ? (
                              <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                            )}
                          </button>
                          {expandedReasoning[message.id || String(index)] && (
                            <div className="mt-2 pt-2 border-t border-border/70 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground/90">
                              {reasoning}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Display "Sage is thinking…" if first tokens haven't appeared yet */}
                      {isStillStarting ? (
                        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground font-sans">
                          <span className="font-serif italic text-foreground">Sage is thinking…</span>
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0.2s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0.4s]" />
                          </span>
                        </div>
                      ) : (
                        /* Markdown Body */
                        <div className="markdown-prose text-sm sm:text-base text-foreground leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {text}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Sage is thinking indicator before assistant turn is added */}
              {isSubmitted && (
                <div className="flex w-full items-start gap-3.5 animate-in fade-in duration-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-primary font-serif font-bold text-xs shadow-2xs mt-0.5">
                    S
                  </div>
                  <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground font-sans">
                    <span className="font-serif italic text-foreground">Sage is thinking…</span>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0.4s]" />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Fixed Composer */}
      <footer className="sticky bottom-0 z-20 w-full shrink-0 border-t border-border bg-background/95 p-4 backdrop-blur-md sm:p-5">
        <div className="mx-auto w-full max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-xs transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message Sage…"
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
            />

            {isBusy ? (
              /* Stop Button */
              <button
                type="button"
                onClick={() => stop()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer shadow-2xs"
                title="Stop generation"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              /* Send Button */
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-35 hover:bg-primary/90 cursor-pointer shadow-2xs"
                title="Send message"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </form>

          <p className="mt-2 text-center text-[11px] text-muted-foreground font-sans">
            Sage may produce inaccurate information. Conversations are stored in memory only.
          </p>
        </div>
      </footer>
    </div>
  );
}
