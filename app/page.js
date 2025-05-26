'use client'
import { useState, useRef, useEffect } from 'react'
import { TbMessageChatbot, TbUser } from "react-icons/tb"
import MarkdownPreview from '@uiw/react-markdown-preview'

const RECOMMENDED_QUESTIONS = [
  "공덕 대장아파트 실거래가 알려주세요.",
  "9억원짜리 아파트 대출 가능한지 계산해주세요.",
  "부동산 직거래 시 대출을 받을 때 임대인의 동의가 필요한가요?",
  "확정일자는 뭐에요?",
  "왕십리 아파트 추천해주세요"
]

export default function Home() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'bot', text: '부동산 도우미 AI 챗봇입니다.' }
  ])
  const [loading, setLoading] = useState(false)
  const [isFirstQuestion, setIsFirstQuestion] = useState(true)
  const [recommended, setRecommended] = useState([])
  const eventSourceRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    setRecommended(RECOMMENDED_QUESTIONS
      .sort(() => Math.random() - 0.5)
      .slice(0, 3))
  }, [])

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    if (isFirstQuestion) setMessages([])

    setMessages(prev => [
      ...prev,
      { role: 'user', text: input }
    ])
    setInput('')
    setLoading(true)
    setIsFirstQuestion(false)

    try {
      setMessages(prev => [
        ...prev,
        { role: 'bot', text: '부물AI가 답변을 준비중입니다...' }
      ])

      const eventSource = new EventSource(`/api/chat/stream?message=${encodeURIComponent(input)}`)
      eventSourceRef.current = eventSource

      let botMsg = ''

      eventSource.onmessage = (event) => {
        if (event.data === '') return
        botMsg += event.data
        setMessages(prev => {
          const filtered = prev.filter(m => m.text !== '부물AI가 답변을 준비중입니다...')
          const lastMsg = filtered[filtered.length - 1]
          return lastMsg?.role === 'bot'
            ? [...filtered.slice(0, -1), { role: 'bot', text: botMsg }]
            : [...filtered, { role: 'bot', text: botMsg }]
        })
      }

      eventSource.addEventListener('done', () => {
        eventSource.close()
        setLoading(false)
      })

      eventSource.onerror = (e) => {
        if (eventSource.readyState === EventSource.CLOSED) {
          setLoading(false)
          return
        }
        eventSource.close()
        setMessages(prev => [
          ...prev.filter(m => m.text !== '부물AI가 답변을 준비중입니다...'),
          { role: 'bot', text: '답변을 가져오는 데 실패했습니다. 다시 시도해 주세요.' }
        ])
        setLoading(false)
      }
    } catch (err) {
      setMessages(prev => [
        ...prev.filter(m => m.text !== '부물AI가 답변을 준비중입니다...'),
        { role: 'bot', text: `오류: ${err.message}` }
      ])
      setLoading(false)
    }
  }

  const handleRecommendedClick = (q) => {
    setInput(q)
  }

  // 메시지 버블
  const MessageBubble = ({ msg }) => (
    <div className="flex items-start gap-3 mb-6">
      {/* 아이콘 */}
      <div className="flex-shrink-0">
        {msg.role === 'user' ? (
          <div className="w-10 h-10 rounded-full bg-white border border-[#d2d9e2] flex items-center justify-center">
            <TbUser size={28} color="#6c8c9c" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-white border border-[#7fdcf4] flex items-center justify-center">
            <TbMessageChatbot size={26} color="#4092bf" />
          </div>
        )}
      </div>
      {/* 말풍선 */}
      <div>
        <div className={`font-semibold text-[15px] mb-1 ${msg.role === 'user' ? 'text-[#171717]' : 'text-[#4092bf]'}`}>
          {msg.role === 'user' ? '질문자' : '부물AI'}
        </div>
        <div className={`
          px-4 py-2 rounded-lg font-medium
          ${msg.role === 'user'
            ? 'bg-[#f4f6fa] text-[#1a202c]'
            : 'bg-[#f8fafc] text-[#1a202c]'}
          text-[15px] max-w-[330px] break-words
        `}>
          {msg.role === 'bot'
            ? <MarkdownPreview source={msg.text} style={{ background: 'transparent', padding: 0, boxShadow: 'none', color: "#1a202c", fontWeight: 500 }} />
            : msg.text}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#f4f6fa]">
      <div className="bg-white p-7 m-3 rounded-2xl border border-[#e5e7eb] w-full max-w-[440px] min-h-[600px] flex flex-col shadow-none">
        {/* 헤더 */}
        <div className="flex flex-col pb-6">
          <h2 className="font-bold text-xl text-[#171717] mb-1">부물AI 챗봇</h2>
          <p className="text-base text-[#2d3748] font-medium">부동산 도우미 AI 챗봇입니다.</p>
        </div>
        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto pr-1 w-full">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        {/* 추천 질문 */}
        {isFirstQuestion && (
          <div className="my-2">
            <div className="bg-[#f8fafc] rounded-lg py-2 px-3 border border-[#e5e7eb]">
              <ul className="space-y-1">
                {recommended.map((q, idx) => (
                  <li key={idx}
                      className="text-[#4a5568] cursor-pointer hover:underline text-sm font-medium"
                      onClick={() => handleRecommendedClick(q)}>
                    {"- "}{q}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {/* 입력창 */}
        <form onSubmit={handleSend} className="flex items-center gap-2 pt-4 w-full">
          <input
            type="text"
            className="flex-1 border border-[#d2d9e2] rounded-lg px-3 py-2 text-base placeholder-[#6c8c9c] focus:outline-none focus:ring-2 focus:ring-[#7fdcf4] disabled:cursor-not-allowed disabled:opacity-50 text-[#1a202c] font-medium"
            placeholder="질문을 입력해주세요"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg text-base font-bold text-white disabled:pointer-events-none disabled:opacity-50 bg-[#6c8c9c] hover:bg-[#4092bf] h-10 px-5 transition-colors"
            disabled={loading || !input}
          >
            {loading ? '전송 중...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
