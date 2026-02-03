'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  MessageCircle,
  Send,
  User,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  Search,
  Loader2,
} from 'lucide-react'
import { chatApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

interface Message {
  id: string
  content: string
  senderType: 'USER' | 'ADMIN' | 'SYSTEM'
  senderId: string
  createdAt: string
}

interface ChatRoom {
  id: string
  userId: string
  user: {
    id: string
    username: string
    email: string
  }
  status: 'OPEN' | 'CLOSED'
  assignedTo?: string
  lastMessageAt: string
  createdAt: string
  messages: Message[]
  _count?: {
    messages: number
  }
}

export default function ChatPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'OPEN' | 'CLOSED'>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchRooms = async () => {
    try {
      const res = await chatApi.getAdminRooms()
      setRooms(res.rooms || [])
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRooms()
    const interval = setInterval(fetchRooms, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchMessages = async (roomId: string) => {
    try {
      const res = await chatApi.getMessages(roomId, { limit: 100 })
      setMessages(res.messages || [])
    } catch {
      // Silently fail
    }
  }

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id)
      const interval = setInterval(() => fetchMessages(selectedRoom.id), 3000)
      return () => clearInterval(interval)
    }
  }, [selectedRoom])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectRoom = (room: ChatRoom) => {
    setSelectedRoom(room)
    setMessages(room.messages || [])
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || isSending) return

    setIsSending(true)
    try {
      const res = await chatApi.sendAdminMessage({
        roomId: selectedRoom.id,
        message: newMessage.trim()
      })
      setMessages(prev => [...prev, res.message])
      setNewMessage('')
    } catch {
      alert('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleCloseRoom = async (roomId: string) => {
    try {
      await chatApi.closeRoom(roomId)
      fetchRooms()
      if (selectedRoom?.id === roomId) {
        setSelectedRoom(prev => prev ? { ...prev, status: 'CLOSED' } : null)
      }
    } catch {
      alert('Failed to close room')
    }
  }

  const handleReopenRoom = async (roomId: string) => {
    try {
      await chatApi.reopenRoom(roomId)
      fetchRooms()
      if (selectedRoom?.id === roomId) {
        setSelectedRoom(prev => prev ? { ...prev, status: 'OPEN' } : null)
      }
    } catch {
      alert('Failed to reopen room')
    }
  }

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || room.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const openCount = rooms.filter(r => r.status === 'OPEN').length
  const closedCount = rooms.filter(r => r.status === 'CLOSED').length

  return (
    <DashboardLayout title="Chat Support" subtitle="Manage user support conversations">
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-180px)]">
        {/* Rooms List */}
        <div className="col-span-4">
          <Card className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
                  <p className="text-sm text-gray-500">{openCount} open, {closedCount} closed</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                {(['all', 'OPEN', 'CLOSED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      statusFilter === status
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? 'All' : status === 'OPEN' ? 'Open' : 'Closed'}
                  </button>
                ))}
              </div>
            </div>

            {/* Rooms */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No conversations</p>
                </div>
              ) : (
                filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => handleSelectRoom(room)}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedRoom?.id === room.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
                          {room.user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{room.user.username}</p>
                          <p className="text-xs text-gray-500">{room.user.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          room.status === 'OPEN'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {room.status === 'OPEN' ? 'Open' : 'Closed'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(room.lastMessageAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Chat Window */}
        <div className="col-span-8">
          <Card className="h-full flex flex-col">
            {selectedRoom ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium">
                      {selectedRoom.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedRoom.user.username}</p>
                      <p className="text-xs text-gray-500">{selectedRoom.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedRoom.status === 'OPEN' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCloseRoom(selectedRoom.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Close
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReopenRoom(selectedRoom.id)}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderType === 'ADMIN' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          message.senderType === 'ADMIN'
                            ? 'bg-blue-500 text-white rounded-br-md'
                            : message.senderType === 'SYSTEM'
                            ? 'bg-gray-200 text-gray-600 text-center text-sm italic'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.senderType === 'ADMIN' ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                {selectedRoom.status === 'OPEN' && (
                  <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || isSending}
                        className="rounded-full w-10 h-10 p-0"
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {selectedRoom.status === 'CLOSED' && (
                  <div className="p-4 border-t border-gray-100 bg-gray-50">
                    <p className="text-center text-sm text-gray-500">
                      This conversation is closed. Reopen it to continue chatting.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Select a conversation</p>
                  <p className="text-sm text-gray-400">Choose a chat from the list to start replying</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
