import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { messageService } from '../services/messageService';
import type { Message } from '../services/messageService';
import { socketService } from '../services/socketService';
import type { NewMessageData } from '@tradeapp/shared';

interface ChatPanelProps {
  jobId: string;
  receiverId: string;
  receiverName: string;
}

export function ChatPanel({ jobId, receiverId, receiverName }: ChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageService.getMessages(jobId).then((msgs) => {
      setMessages(msgs);
      setLoading(false);
    }).catch(() => setLoading(false));

    socketService.joinJobRoom(jobId);

    const handler = (data: NewMessageData) => {
      if (data.jobId !== jobId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.messageId)) return prev;
        return [...prev, {
          id: data.messageId,
          jobId: data.jobId,
          senderId: data.senderId,
          receiverId: data.senderId === user?.id ? receiverId : user?.id ?? '',
          senderName: data.senderName,
          content: data.content,
          isRead: false,
          createdAt: data.timestamp,
        }];
      });
    };

    socketService.on('new_message', handler);

    return () => {
      socketService.off('new_message', handler);
      socketService.leaveJobRoom(jobId);
    };
  }, [jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    try {
      const msg = await messageService.sendMessage(jobId, receiverId, content);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch {
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-surface)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        background: 'var(--color-navy)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--color-amber)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9rem', color: '#fff',
          flexShrink: 0,
        }}>
          {receiverName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-display)' }}>{receiverName}</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>Job chat</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 10,
        minHeight: 260, maxHeight: 400,
        background: '#f8faff',
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <span className="spinner" />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', paddingTop: 40 }}>
            No messages yet. Send a message to get started.
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === user?.id;
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: isOwn ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: isOwn ? 'var(--color-amber)' : 'var(--color-navy)',
                  color: '#fff',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                  {!isOwn && <span style={{ marginRight: 6 }}>{msg.senderName}</span>}
                  {new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex', gap: 10, alignItems: 'flex-end',
        background: 'var(--color-surface)',
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          style={{
            flex: 1, resize: 'none', border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius)', padding: '10px 14px',
            fontFamily: 'var(--font-body)', fontSize: '0.875rem',
            background: '#f8faff', color: 'var(--color-text)',
            outline: 'none', maxHeight: 120, overflowY: 'auto',
          }}
          maxLength={2000}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            padding: '10px 18px', border: 'none', borderRadius: 'var(--radius)',
            background: input.trim() && !sending ? 'var(--color-amber)' : 'var(--color-border)',
            color: '#fff', fontWeight: 700, fontSize: '0.875rem',
            cursor: input.trim() && !sending ? 'pointer' : 'default',
            fontFamily: 'var(--font-body)', transition: 'background 0.15s',
            flexShrink: 0,
          }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
