'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, Paperclip, Loader2, ChevronDown } from 'lucide-react'
import { chatApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

interface Message {
  id: string
  senderId: string
  senderRole: 'USER' | 'ADMIN'
  message: string
  attachmentUrl?: string
  attachmentType?: string
  isRead: boolean
  createdAt: string
}

interface ChatRoom {
  id: string
  status: string
  messages: Message[]
}

export function LiveChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch unread count periodically
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await chatApi.getUnreadCount()
        setUnreadCount(res.unreadCount)
      } catch (error) {
        // Silently fail
      }
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 10000) // Every 10 seconds
    return () => clearInterval(interval)
  }, [])

  // Fetch room and messages when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      const fetchRoom = async () => {
        setIsLoading(true)
        try {
          const res = await chatApi.getRoom()
          setRoom(res.room)
          setMessages(res.room.messages || [])
          setUnreadCount(0) // Clear unread when opened
        } catch (error) {
          // Silently fail
        } finally {
          setIsLoading(false)
        }
      }
      fetchRoom()
    }
  }, [isOpen, isMinimized])

  // Poll for new messages when chat is open
  useEffect(() => {
    if (!isOpen || isMinimized || !room) return

    const pollMessages = async () => {
      try {
        const res = await chatApi.getMessages(room.id, { limit: 50 })
        setMessages(res.messages)
      } catch (error) {
        // Silently fail
      }
    }

    const interval = setInterval(pollMessages, 3000) // Every 3 seconds
    return () => clearInterval(interval)
  }, [isOpen, isMinimized, room])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    try {
      const res = await chatApi.sendMessage({
        roomId: room?.id,
        message: newMessage.trim()
      })

      setMessages(prev => [...prev, res.message])
      setNewMessage('')
      inputRef.current?.focus()
    } catch (error) {
      // Show error
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 hover:scale-110"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 transition-all duration-300 ${
            isMinimized ? 'w-72 h-14' : 'w-96 h-[500px]'
          }`}
        >
          {/* Header */}
          <div
            className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white px-4 py-3 flex items-center justify-between cursor-pointer"
            onClick={() => isMinimized && setIsMinimized(false)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Live Support</h3>
                {!isMinimized && (
                  <p className="text-xs text-white/80">We typically reply in a few minutes</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMinimized(!isMinimized)
                }}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                }}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50" style={{ height: 'calc(100% - 130px)' }}>
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <MessageCircle className="w-12 h-12 mb-3 text-gray-300" />
                    <p className="text-sm font-medium">Start a conversation</p>
                    <p className="text-xs text-gray-400 mt-1">We're here to help!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.senderRole === 'USER' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                            msg.senderRole === 'USER'
                              ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white rounded-br-md'
                              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md shadow-sm'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          {msg.attachmentUrl && (
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs underline mt-1 block ${
                                msg.senderRole === 'USER' ? 'text-white/80' : 'text-[#8B5CF6]'
                              }`}
                            >
                              View attachment
                            </a>
                          )}
                          <span
                            className={`text-xs mt-1 block ${
                              msg.senderRole === 'USER' ? 'text-white/60' : 'text-gray-400'
                            }`}
                          >
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-100 bg-white">
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 bg-gray-100 border-0 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                    disabled={isSending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || isSending}
                    className="p-2 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
