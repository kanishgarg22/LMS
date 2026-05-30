'use client';

import { useState, useRef, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { aiApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Send, Mic, MicOff, Sparkles, User, Bot, RefreshCw, Zap } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolResults?: Array<{ tool: string; result: unknown }>;
}

const SUGGESTIONS = [
  'Who was absent today?',
  'Show this month payroll',
  'Show pending salaries',
  'Mark Rahul present today',
  'How much advance did workers take?',
  'Show labour expenses this month',
  'Which workers have overtime today?',
  'Generate monthly summary',
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: '👋 Hello! I am your AI Labour Management Assistant.\n\nI can help you:\n• Mark attendance for workers\n• Check payroll and pending salaries\n• Find absent workers\n• View advance payments\n• Generate reports\n\nAsk me anything in **English or Hindi!**',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await aiApi.chat(history);
      const { message, toolResults } = res.data.data;

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: message || 'I processed your request.',
        timestamp: new Date(),
        toolResults,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Sorry, I encountered an error. Please check if the AI service is configured.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'voice.webm');
        try {
          const { default: axios } = await import('axios');
          const token = localStorage.getItem('lms_token');
          const res = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/api/ai/voice`,
            fd,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.data.data?.transcript) {
            sendMessage(res.data.data.transcript);
          }
        } catch {
          console.error('Transcription failed');
        }
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch {
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/•/g, '&bull;');
  };

  return (
    <AppShell>
      <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">AI Labour Assistant</h2>
            <p className="text-xs text-gray-400">Powered by GPT-4 · Hindi & English</p>
          </div>
          <button
            onClick={() => setMessages(prev => [prev[0]])}
            className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"
            title="Clear chat"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                msg.role === 'user' ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-purple-600'
              )}>
                {msg.role === 'user'
                  ? <User className="w-4 h-4 text-white" />
                  : <Bot className="w-4 h-4 text-white" />
                }
              </div>
              <div className={cn(
                'max-w-[80%] space-y-2',
                msg.role === 'user' ? 'items-end' : 'items-start'
              )}>
                <div className={cn(
                  'px-4 py-3 rounded-2xl text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-sm'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                )}>
                  <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                </div>

                {msg.toolResults && msg.toolResults.length > 0 && (
                  <div className="space-y-1">
                    {msg.toolResults.map((tr, i) => (
                      <div key={i} className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-xs text-violet-700">
                        <div className="flex items-center gap-1 font-semibold mb-1">
                          <Zap className="w-3 h-3" />
                          Action: {tr.tool.replace(/_/g, ' ')}
                        </div>
                        <pre className="text-xs text-violet-600 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(tr.result, null, 2).slice(0, 200)}
                          {JSON.stringify(tr.result).length > 200 && '...'}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-400 px-1">
                  {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-4 py-2">
            <p className="text-xs text-gray-400 mb-2">Try asking:</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="flex-shrink-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask anything... (English या Hindi में)"
                rows={1}
                className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none max-h-24"
                style={{ minHeight: '24px' }}
              />
            </div>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                'p-3 rounded-2xl transition-all flex-shrink-0',
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="p-3 bg-primary text-white rounded-2xl hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </AppShell>
  );
}
