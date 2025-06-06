'use client'
import { useState, useEffect, useRef } from 'react'
import MarkdownPreview from '@uiw/react-markdown-preview'
import remarkGfm from 'remark-gfm'

export default function TestChatPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'bot', text: '마크다운 테스트 챗봇입니다.' }
  ])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // 자동 스크롤 처리
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const newMessages = [...messages, { role: 'user', text: input }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/test-markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })
      const data = await res.json()

      // 마크다운 강력한 포맷팅
// /app/test-chat/page.js
const cleanedMarkdown = data.markdown
//   .replace(/(\d+)\.\s*\n/g, '$1. ') // 번호 뒤 개행 제거
//   .replace(/(\n)(?=\d+\.)/g, '\n\n') // 번호 앞 개행 강화
//   .replace(/(\S)\n(\S)/g, '$1 $2'); // 단어 중간 개행 병합


      setMessages([...newMessages, { role: 'bot', text: cleanedMarkdown }])
    } catch (err) {
      setMessages([...newMessages, { role: 'bot', text: `⚠️ 시스템 오류: ${err.message}` }])
    }
    setLoading(false)
  }

  const MessageBubble = ({ msg }) => (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`max-w-[80%] p-4 rounded-lg ${
        msg.role === 'user' 
          ? 'bg-blue-100 text-blue-800' 
          : 'bg-gray-100 text-gray-800'
      }`}>
        <div className="font-semibold mb-1">
          {msg.role === 'user' ? '👤 나' : '🤖 챗봇'}
        </div>
        <div className="break-words">
          {msg.role === 'bot' ? (
            <MarkdownPreview
              source={msg.text}
              remarkPlugins={[remarkGfm]}
              className="markdown-body"
              style={{
                background: 'transparent',
                padding: 0,
                color: 'inherit',
                fontSize: '1rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap'
              }}
              components={{
                ol: ({ children }) => <ol className="pl-6 list-decimal">{children}</ol>,
                ul: ({ children }) => <ul className="pl-6 list-disc">{children}</ul>
              }}
            />
          ) : msg.text}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">마크다운 채팅 테스트</h1>
        
        <div className="h-[500px] overflow-y-auto mb-4 pr-2">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          {loading && (
            <div className="text-center text-gray-500">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full"></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요"
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            className={`px-6 py-2 rounded-lg text-white font-medium ${
              loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
            }`}
            disabled={loading}
          >
            {loading ? '전송 중...' : '전송'}
          </button>
        </form>
      </div>
    </div>
  )
}
