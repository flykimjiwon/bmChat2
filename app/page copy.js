'use client'
import { useState, useRef, useEffect } from 'react'

export default function Home() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const eventSourceRef = useRef(null)
  const messagesEndRef = useRef(null)

  // 컴포넌트 언마운트 시 SSE 연결 해제
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', text: input }])

    try {
      const eventSource = new EventSource(`/api/chat/stream?message=${encodeURIComponent(input)}`)
      eventSourceRef.current = eventSource

      let botMsg = ''

      eventSource.onmessage = (event) => {
        if (event.data === '') return // done 이벤트 등 빈 데이터 무시
        botMsg += event.data
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1]
          return lastMsg?.role === 'bot'
            ? [...prev.slice(0, -1), { role: 'bot', text: botMsg }]
            : [...prev, { role: 'bot', text: botMsg }]
        })
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }

      // 서버에서 event: done을 보내면 정상 종료 처리
      eventSource.addEventListener('done', () => {
        console.log('[SSE] 서버에서 정상 종료 신호 수신')
        eventSource.close()
        setLoading(false)
      })

      // 네트워크 오류 등 비정상 종료만 처리
      eventSource.onerror = (e) => {
        // readyState가 CLOSED(2)이면 정상 종료이므로 무시
        if (eventSource.readyState === EventSource.CLOSED) {
          setLoading(false)
          return
        }
        console.error('[SSE] 연결 비정상 종료', e)
        eventSource.close()
        setMessages(prev => [...prev, { role: 'bot', text: '🚨 연결이 비정상적으로 종료되었습니다' }])
        setLoading(false)
      }

    } catch (err) {
      console.error('SSE 연결 실패:', err)
      setMessages(prev => [...prev, { role: 'bot', text: `오류: ${err.message}` }])
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center px-2 py-4">
      <div className="w-full max-w-md flex flex-col flex-1 bg-white rounded-xl shadow-lg p-4">
        <div className="flex-1 overflow-y-auto space-y-3 mb-2" style={{ minHeight: 300 }}>
          {messages.map((msg, i) => (
            <div key={i} className={`whitespace-pre-line ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <span className={`inline-block px-3 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-100 text-blue-900'
                  : 'bg-gray-200 text-gray-800'
              }`}>
                {msg.text}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            className="flex-1 border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="메시지 입력..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? '전송 중...' : '전송'}
          </button>
        </form>
      </div>
    </main>
  )
}
