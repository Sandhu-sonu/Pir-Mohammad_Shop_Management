'use client';

import React, { useState } from 'react';
import { assignTicketAction, addTicketMessageAction } from '@/lib/actions/admin';
import { SupportTicketStatus, TicketPriority } from '@prisma/client';

interface MessageItem {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  message: string;
  createdAt: string;
}

interface TicketItem {
  id: string;
  shopName: string;
  ownerName: string;
  mobile: string;
  title: string;
  status: SupportTicketStatus;
  priority: TicketPriority;
  assignedToUserId: string;
  messages: MessageItem[];
}

interface AdminItem {
  id: string;
  name: string;
}

interface SupportTicketManagerProps {
  initialTickets: TicketItem[];
  admins: AdminItem[];
}

export default function SupportTicketManager({ initialTickets, admins }: SupportTicketManagerProps) {
  const [tickets, setTickets] = useState<TicketItem[]>(initialTickets);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    initialTickets.length > 0 ? initialTickets[0].id : null
  );
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  const handleAssign = async (ticketId: string, adminId: string) => {
    setError('');
    const res = await assignTicketAction(ticketId, adminId);
    if (res.success) {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, assignedToUserId: adminId, status: SupportTicketStatus.IN_PROGRESS } : t))
      );
    } else {
      setError(res.error || 'Failed to assign ticket.');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyMessage.trim()) return;

    setLoading(true);
    setError('');

    const res = await addTicketMessageAction(selectedTicketId, replyMessage);
    if (res.success) {
      const now = new Date();
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === selectedTicketId) {
            return {
              ...t,
              messages: [
                ...t.messages,
                {
                  id: Math.random().toString(36),
                  userId: 'system-admin', // Client fallback identifier
                  userName: 'Support Agent',
                  userRole: 'SUPER_ADMIN',
                  message: replyMessage,
                  createdAt: now.toISOString()
                }
              ]
            };
          }
          return t;
        })
      );
      setReplyMessage('');
    } else {
      setError(res.error || 'Failed to send message.');
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
      {/* Left Panel: Tickets List */}
      <div className="lg:col-span-1 border-r border-gray-800 pr-6 space-y-3 max-h-[600px] overflow-y-auto">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Help Tickets</h3>
        {tickets.map((t) => (
          <div
            key={t.id}
            onClick={() => {
              setSelectedTicketId(t.id);
              setError('');
            }}
            className={`p-4 rounded-xl cursor-pointer border transition duration-150 ${
              selectedTicketId === t.id
                ? 'bg-gray-800 border-primary'
                : 'bg-gray-950 border-gray-800 hover:bg-gray-900/50'
            }`}
            style={selectedTicketId === t.id ? { borderColor: '#FF6B6B' } : {}}
          >
            <div className="flex justify-between items-start">
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                t.priority === TicketPriority.HIGH ? 'bg-red-950 text-red-400' : 'bg-gray-800 text-gray-400'
              }`}>
                {t.priority}
              </span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                t.status === SupportTicketStatus.OPEN ? 'bg-green-950 text-green-400' : 'bg-blue-950 text-blue-400'
              }`}>
                {t.status}
              </span>
            </div>
            <h4 className="text-white font-bold text-sm mt-2 line-clamp-1">{t.title}</h4>
            <p className="text-xs text-gray-500 mt-1">{t.shopName} ({t.ownerName})</p>
          </div>
        ))}
        {tickets.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">No tickets active.</p>
        )}
      </div>

      {/* Right Panel: Chat Messages Thread */}
      <div className="lg:col-span-2 flex flex-col justify-between max-h-[600px]">
        {selectedTicket ? (
          <>
            {/* Ticket Header & Assignment */}
            <div className="border-b border-gray-800 pb-4 mb-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedTicket.title}</h3>
                <p className="text-xs text-gray-500 mt-1">Shop: {selectedTicket.shopName} | Owner: {selectedTicket.ownerName} ({selectedTicket.mobile})</p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 font-medium">Assignee:</span>
                <select
                  value={selectedTicket.assignedToUserId}
                  onChange={(e) => handleAssign(selectedTicket.id, e.target.value)}
                  className="bg-gray-950 border border-gray-800 text-white text-xs rounded-lg p-1.5"
                >
                  <option value="">Unassigned</option>
                  {admins.map((adm) => (
                    <option key={adm.id} value={adm.id}>
                      {adm.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Messages body */}
            <div className="flex-grow overflow-y-auto space-y-4 pr-2 min-h-[300px]">
              {selectedTicket.messages.map((msg) => {
                const isAdmin = msg.userRole === 'SUPER_ADMIN';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[80%] rounded-2xl p-4 ${
                      isAdmin ? 'bg-primary/15 border border-primary/20 self-end ml-auto' : 'bg-gray-950 border border-gray-800 self-start mr-auto'
                    }`}
                    style={isAdmin ? { backgroundColor: 'rgba(255, 107, 107, 0.15)', borderColor: 'rgba(255, 107, 107, 0.2)' } : {}}
                  >
                    <span className="text-[10px] text-gray-500 font-bold mb-1">{msg.userName} ({msg.userRole})</span>
                    <p className="text-sm text-white font-medium">{msg.message}</p>
                    <span className="text-[9px] text-gray-600 text-right mt-1.5">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Chat Input form */}
            <form onSubmit={handleSendReply} className="border-t border-gray-800 pt-4 mt-4 space-y-3">
              {error && (
                <div className="text-red-400 text-xs font-semibold">{error}</div>
              )}
              <div className="flex space-x-3">
                <input
                  type="text"
                  placeholder="Type support reply or fix details..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="flex-grow bg-gray-950 border border-gray-800 rounded-xl p-3 text-white focus:outline-none text-sm"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !replyMessage.trim()}
                  className="bg-primary hover:bg-opacity-95 text-white font-bold px-6 rounded-xl text-sm transition duration-150"
                  style={{ backgroundColor: '#FF6B6B' }}
                >
                  Send Reply
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-col justify-center items-center h-full text-gray-500">
            <p>Select a ticket to begin messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}
