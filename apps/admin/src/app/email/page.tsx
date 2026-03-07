'use client'

import { useEffect, useRef, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { emailApi, usersApi, agentsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import {
  Mail, Send, Search, Loader2, X, Users as UsersIcon, CheckCircle, AlertCircle,
  ChevronLeft, ChevronRight, Clock, Building2, Inbox, MailCheck, MailX, UserCheck
} from 'lucide-react'

type User = {
  id: string
  username: string
  email: string
  agent?: { id: string; username: string } | null
  agentId?: string | null
}

type Agent = {
  id: string
  username: string
  email: string
  _count?: { users: number }
}

type EmailLog = {
  id: string
  recipientEmail: string
  recipientName: string | null
  agentName: string | null
  smtpUsed: string | null
  subject: string
  status: string
  error: string | null
  createdAt: string
}

type RecipientMode = 'all' | 'agent' | 'select'

export default function EmailPage() {
  const toast = useToast()
  const confirm = useConfirm()

  // Users data
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  // Agents data
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [agentSearch, setAgentSearch] = useState('')
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)

  // Recipient mode
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('select')

  // Compose form
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  // Logs
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotalPages, setLogsTotalPages] = useState(1)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logSearch, setLogSearch] = useState('')

  // Stats
  const [totalSent, setTotalSent] = useState(0)
  const [totalFailed, setTotalFailed] = useState(0)

  // Tabs sliding indicator
  const tabAllRef = useRef<HTMLButtonElement>(null)
  const tabAgentRef = useRef<HTMLButtonElement>(null)
  const tabSelectRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  useEffect(() => {
    fetchUsers()
    fetchAgents()
    fetchLogs(1)
  }, [])

  // Update tab indicator on mode change
  useEffect(() => {
    const updateIndicator = () => {
      let ref = tabSelectRef
      if (recipientMode === 'all') ref = tabAllRef
      else if (recipientMode === 'agent') ref = tabAgentRef

      if (ref.current) {
        setIndicatorStyle({
          left: ref.current.offsetLeft,
          width: ref.current.offsetWidth,
        })
      }
    }
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [recipientMode])

  const fetchUsers = async () => {
    try {
      const data = await usersApi.getAll()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const data = await agentsApi.getAll()
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    }
  }

  const fetchLogs = async (page: number) => {
    setLogsLoading(true)
    try {
      const data = await emailApi.getLogs(page, 25)
      setLogs(data.logs || [])
      setLogsTotalPages(data.pages || 1)
      setLogsTotal(data.total || 0)
      setLogsPage(data.page || 1)

      const allLogs = data.logs || []
      const failedCount = allLogs.filter((l: EmailLog) => l.status === 'FAILED').length
      setTotalSent(data.total - failedCount)
      setTotalFailed(failedCount)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleAddUser = (user: User) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user])
    }
    setUserSearch('')
    setShowUserDropdown(false)
  }

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId))
  }

  const filteredUsers = users.filter(u =>
    !selectedUsers.find(s => s.id === u.id) &&
    (u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
     u.email.toLowerCase().includes(userSearch.toLowerCase()))
  )

  const filteredAgents = agents.filter(a =>
    a.username.toLowerCase().includes(agentSearch.toLowerCase()) ||
    a.email.toLowerCase().includes(agentSearch.toLowerCase())
  )

  const agentUserCount = selectedAgent
    ? users.filter(u => u.agent?.id === selectedAgent.id).length
    : 0

  const handleModeChange = (mode: RecipientMode) => {
    setRecipientMode(mode)
    if (mode === 'all') {
      setSelectedUsers([])
      setSelectedAgent(null)
      setAgentSearch('')
    } else if (mode === 'agent') {
      setSelectedUsers([])
    } else {
      setSelectedAgent(null)
      setAgentSearch('')
    }
  }

  const recipientCount = recipientMode === 'all'
    ? users.length
    : recipientMode === 'agent'
      ? agentUserCount
      : selectedUsers.length

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.warning('Missing Subject', 'Please enter an email subject')
      return
    }
    if (!body.trim()) {
      toast.warning('Missing Body', 'Please enter the email body')
      return
    }
    if (recipientMode === 'select' && selectedUsers.length === 0) {
      toast.warning('No Recipients', 'Please select at least one user')
      return
    }
    if (recipientMode === 'agent' && !selectedAgent) {
      toast.warning('No Agent Selected', 'Please select an agent')
      return
    }
    if (recipientMode === 'agent' && selectedAgent && agentUserCount === 0) {
      toast.warning('No Users', `Agent "${selectedAgent.username}" has no users`)
      return
    }

    const recipientLabel = recipientMode === 'all'
      ? `all ${users.length} users`
      : recipientMode === 'agent'
        ? `${agentUserCount} users of agent "${selectedAgent?.username}"`
        : `${selectedUsers.length} selected user${selectedUsers.length > 1 ? 's' : ''}`

    const confirmed = await confirm({
      title: 'Send Email',
      message: `Send this email to ${recipientLabel}?`,
      confirmLabel: 'Send',
      cancelLabel: 'Cancel',
    })

    if (!confirmed) return

    setSending(true)
    try {
      let result
      if (recipientMode === 'all') {
        result = await emailApi.sendAll({ subject, body })
      } else if (recipientMode === 'agent' && selectedAgent) {
        result = await emailApi.sendToAgent({ agentId: selectedAgent.id, subject, body })
      } else {
        result = await emailApi.send({
          userIds: selectedUsers.map(u => u.id),
          subject,
          body,
        })
      }

      if (result.failed === 0) {
        toast.success('Emails Sent', `Successfully sent to ${result.sent} user${result.sent > 1 ? 's' : ''}`)
      } else {
        toast.warning('Partially Sent', `Sent: ${result.sent}, Failed: ${result.failed} out of ${result.total}`)
      }

      setSubject('')
      setBody('')
      setSelectedUsers([])
      setRecipientMode('select')
      setSelectedAgent(null)
      setAgentSearch('')
      fetchLogs(1)
    } catch (error: any) {
      toast.error('Send Failed', error.message || 'Failed to send emails')
    } finally {
      setSending(false)
    }
  }

  const filteredLogs = logs.filter(l =>
    !logSearch ||
    l.recipientName?.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.recipientEmail.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.subject.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.agentName?.toLowerCase().includes(logSearch.toLowerCase())
  )

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(date))
  }

  return (
    <DashboardLayout title="Email Sender">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Emails"
          value={logsTotal}
          icon={Mail}
          iconColor="bg-primary-100 text-primary-600"
        />
        <StatCard
          title="Delivered"
          value={totalSent}
          icon={MailCheck}
          iconColor="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Failed"
          value={totalFailed}
          icon={MailX}
          iconColor="bg-red-100 text-red-600"
        />
      </div>

      {/* Compose Email Card */}
      <Card className="p-0 mb-6 overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <Send className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Compose Email</h2>
              <p className="text-xs text-gray-400">Send branded emails to your users</p>
            </div>
          </div>
          {recipientCount > 0 && (
            <div className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">{recipientCount} recipient{recipientCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Recipient Mode Tabs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Send To</label>
            <div className="relative inline-flex bg-gray-100 rounded-lg p-0.5">
              {/* Sliding Indicator */}
              <div
                className="absolute top-0.5 bottom-0.5 rounded-md bg-white shadow-sm transition-all duration-200 ease-out"
                style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px` }}
              />
              <button
                ref={tabSelectRef}
                onClick={() => handleModeChange('select')}
                className={`relative z-10 flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  recipientMode === 'select' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Select Users
              </button>
              <button
                ref={tabAgentRef}
                onClick={() => handleModeChange('agent')}
                className={`relative z-10 flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  recipientMode === 'agent' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Agent&apos;s Users
              </button>
              <button
                ref={tabAllRef}
                onClick={() => handleModeChange('all')}
                className={`relative z-10 flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  recipientMode === 'all' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UsersIcon className="w-3.5 h-3.5" />
                All Users
              </button>
            </div>
          </div>

          {/* Recipient Content Based on Mode */}
          {recipientMode === 'all' && (
            <div className="flex items-center gap-3 p-3.5 bg-primary-50 border border-primary-100 rounded-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                <UsersIcon className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-900">Sending to all users</p>
                <p className="text-xs text-primary-600">{users.length} users will receive this email</p>
              </div>
            </div>
          )}

          {recipientMode === 'agent' && (
            <div>
              {/* Selected agent badge */}
              {selectedAgent ? (
                <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {selectedAgent.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 truncate">{selectedAgent.username}</p>
                    <p className="text-xs text-blue-600">{agentUserCount} user{agentUserCount !== 1 ? 's' : ''} will receive this email</p>
                  </div>
                  <button
                    onClick={() => { setSelectedAgent(null); setAgentSearch('') }}
                    className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={agentSearch}
                      onChange={(e) => { setAgentSearch(e.target.value); setShowAgentDropdown(true) }}
                      onFocus={() => setShowAgentDropdown(true)}
                      placeholder="Search agents by name or email..."
                      className="block w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>

                  {showAgentDropdown && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setShowAgentDropdown(false)} />
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-[70] bg-white rounded-xl shadow-lg border border-gray-200 max-h-56 overflow-y-auto">
                        {filteredAgents.length === 0 ? (
                          <div className="p-4 text-sm text-gray-400 text-center">
                            {agentSearch ? 'No agents found' : 'Type to search agents...'}
                          </div>
                        ) : (
                          filteredAgents.slice(0, 20).map(agent => {
                            const userCount = users.filter(u => u.agent?.id === agent.id).length
                            return (
                              <button
                                key={agent.id}
                                onClick={() => { setSelectedAgent(agent); setAgentSearch(''); setShowAgentDropdown(false) }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                              >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                  {agent.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">{agent.username}</p>
                                  <p className="text-xs text-gray-400 truncate">{agent.email}</p>
                                </div>
                                <Badge variant="default">{userCount} users</Badge>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {recipientMode === 'select' && (
            <div>
              {/* Selected users badges */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {selectedUsers.map(user => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full border border-primary-200"
                    >
                      <span className="w-4 h-4 rounded-full bg-primary-200 flex items-center justify-center text-primary-700 text-[9px] font-bold flex-shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                      {user.username}
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-primary-200 text-primary-400 hover:text-primary-700 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setShowUserDropdown(true) }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder="Search users by name or email..."
                    className="block w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                {showUserDropdown && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowUserDropdown(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-[70] bg-white rounded-xl shadow-lg border border-gray-200 max-h-56 overflow-y-auto">
                      {filteredUsers.length === 0 ? (
                        <div className="p-4 text-sm text-gray-400 text-center">
                          {userSearch ? 'No users found' : 'Type to search users...'}
                        </div>
                      ) : (
                        filteredUsers.slice(0, 20).map(user => (
                          <button
                            key={user.id}
                            onClick={() => handleAddUser(user)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{user.username}</p>
                              <p className="text-xs text-gray-400 truncate">{user.email}</p>
                            </div>
                            {user.agent && (
                              <Badge variant="info">{user.agent.username}</Badge>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your email message here..."
              rows={7}
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none leading-relaxed"
            />
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
              <Inbox className="w-3.5 h-3.5" />
              Message will be wrapped in a branded email template with the user&apos;s agent branding
            </p>
          </div>

          {/* Send Actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-gray-400">
              {recipientMode === 'all' && `${users.length} users will receive this email`}
              {recipientMode === 'agent' && selectedAgent && `${agentUserCount} users of ${selectedAgent.username}`}
              {recipientMode === 'select' && selectedUsers.length > 0 && `${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''} selected`}
            </div>
            <Button
              onClick={handleSend}
              loading={sending}
              disabled={sending}
              size="md"
            >
              <Send className="w-4 h-4" />
              Send Email
            </Button>
          </div>
        </div>
      </Card>

      {/* Email History Card */}
      <Card className="p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <Clock className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Email History</h2>
              <p className="text-xs text-gray-400">{logsTotal} total emails sent</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Search history..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 w-56 transition-colors bg-gray-50 focus:bg-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* Table Content */}
        {logsLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400 mb-3" />
            <p className="text-sm text-gray-400">Loading email history...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Mail className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">No emails sent yet</p>
            <p className="text-xs text-gray-400 mt-1">Compose your first email above</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Recipient</TableCell>
                    <TableCell header>Agent</TableCell>
                    <TableCell header>Subject</TableCell>
                    <TableCell header>Via</TableCell>
                    <TableCell header>Status</TableCell>
                    <TableCell header>Date</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 text-[10px] font-semibold flex-shrink-0">
                            {(log.recipientName || log.recipientEmail).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{log.recipientName || '-'}</p>
                            <p className="text-[11px] text-gray-400 truncate">{log.recipientEmail}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.agentName ? (
                          <span className="text-sm text-gray-700">{log.agentName}</span>
                        ) : (
                          <span className="text-sm text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-gray-700 max-w-[200px] truncate">{log.subject}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.smtpUsed === 'agent' ? 'info' : 'default'}>
                          {log.smtpUsed === 'agent' ? 'Agent SMTP' : 'Default'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'SENT' ? 'success' : 'danger'}>
                          {log.status === 'SENT' ? 'Sent' : 'Failed'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(log.createdAt)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {logsTotalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Page {logsPage} of {logsTotalPages} &middot; {logsTotal} total
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchLogs(logsPage - 1)}
                    disabled={logsPage <= 1}
                    className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  {Array.from({ length: Math.min(logsTotalPages, 5) }, (_, i) => {
                    const pageNum = logsPage <= 3
                      ? i + 1
                      : logsPage >= logsTotalPages - 2
                        ? logsTotalPages - 4 + i
                        : logsPage - 2 + i
                    if (pageNum < 1 || pageNum > logsTotalPages) return null
                    return (
                      <button
                        key={pageNum}
                        onClick={() => fetchLogs(pageNum)}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          pageNum === logsPage
                            ? 'bg-primary-500 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => fetchLogs(logsPage + 1)}
                    disabled={logsPage >= logsTotalPages}
                    className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </DashboardLayout>
  )
}
