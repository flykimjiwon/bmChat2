'use client'
import { useState, useRef, useEffect } from 'react'
import { TbMessageChatbot, TbUser } from "react-icons/tb"
import MarkdownPreview from '@uiw/react-markdown-preview'

// 스피너용 CSS를 전역에 추가 (Next.js 환경에서는 globals.css에 넣는 것이 정석)
const spinnerStyle = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #4092bf;
  border-top-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}
`
if (typeof window !== 'undefined' && !document.getElementById('ai-spinner-style')) {
  const styleTag = document.createElement('style')
  styleTag.id = 'ai-spinner-style'
  styleTag.innerHTML = spinnerStyle
  document.head.appendChild(styleTag)
}

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

  // 로딩 인터랙티브 상태
  const [loadingText, setLoadingText] = useState('답변 준비중')
  const [dots, setDots] = useState('.')
  const loadingInterval = useRef(null)
  const loadingTextInterval = useRef(null)

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
      if (loadingInterval.current) clearInterval(loadingInterval.current)
      if (loadingTextInterval.current) clearInterval(loadingTextInterval.current)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

// 로딩 애니메이션 효과
useEffect(() => {
  if (loading) {
    setLoadingText('답변 준비중')
    setDots('.')
    if (loadingInterval.current) clearInterval(loadingInterval.current)
    if (loadingTextInterval.current) clearTimeout(loadingTextInterval.current)

    loadingInterval.current = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '.' : prev + '.')
    }, 500)

    // 0.5초 뒤 한 번만 "활용될 툴을 찾고 있습니다"로 변경
    loadingTextInterval.current = setTimeout(() => {
      setLoadingText('활용될 툴을 찾고 있습니다')
    }, 500)
  } else {
    setDots('.')
    setLoadingText('답변 준비중')
    if (loadingInterval.current) clearInterval(loadingInterval.current)
    if (loadingTextInterval.current) clearTimeout(loadingTextInterval.current)
  }
}, [loading])

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

    setMessages(prev => [
      ...prev,
      { role: 'bot', text: '부물AI가 답변을 준비중입니다...' }
    ])

    try {
      const eventSource = new EventSource(`/api/chat/stream?message=${encodeURIComponent(input)}`)
      eventSourceRef.current = eventSource

      let botMsg = ''

      eventSource.onmessage = (event) => {
        if (!event.data) return
        botMsg += event.data
        setMessages(prev => {
          // "준비중입니다" 메시지는 제거
          const filtered = prev.filter(m => m.text !== '부물AI가 답변을 준비중입니다...')
          const lastMsg = filtered[filtered.length - 1]
          return lastMsg?.role === 'bot'
            ? [...filtered.slice(0, -1), { role: 'bot', text: botMsg }]
            : [...filtered, { role: 'bot', text: botMsg }]
        })
      }

      // 커스텀 에러 이벤트 처리
      eventSource.addEventListener('error', (event) => {
        try {
          const errorData = JSON.parse(event.data)
          setMessages(prev => [
            ...prev.filter(m => m.text !== '부물AI가 답변을 준비중입니다...'),
            { 
              role: 'bot', 
              text: `⚠️ 오류 발생: ${errorData.message || '서버 처리 중 문제가 발생했습니다'}`
            }
          ])
        } catch {
          setMessages(prev => [
            ...prev.filter(m => m.text !== '부물AI가 답변을 준비중입니다...'),
            { role: 'bot', text: '⚠️ 알 수 없는 오류가 발생했습니다' }
          ])
        }
        eventSource.close()
        setLoading(false)
      })

      // 스트림 종료 처리
      eventSource.addEventListener('done', () => {
        eventSource.close()
        setLoading(false)
      })

      // 네트워크 레벨 에러 처리
      eventSource.onerror = (e) => {
        if (eventSource.readyState === EventSource.CLOSED) {
          setLoading(false)
          return
        }
        eventSource.close()
        setMessages(prev => [
          ...prev.filter(m => m.text !== '부물AI가 답변을 준비중입니다...'),
          { role: 'bot', text: '⚠️ 네트워크 연결이 불안정합니다. 다시 시도해 주세요' }
        ])
        setLoading(false)
      }
    } catch (err) {
      setMessages(prev => [
        ...prev.filter(m => m.text !== '부물AI가 답변을 준비중입니다...'),
        { role: 'bot', text: `⚠️ 시스템 오류: ${err.message}` }
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
      <div>
        <div className={`font-semibold text-[15px] mb-1 ${msg.role === 'user' ? 'text-[#171717]' : 'text-[#4092bf]'}`}>
          {msg.role === 'user' ? '질문자' : '부물AI'}
        </div>
        <div className={`
          px-4 py-2 rounded-lg font-medium
          ${msg.role === 'user'
            ? 'bg-[#f4f6fa] text-[#1a202c]'
            : 'bg-[#f8fafc] text-[#1a202c]'}
          ${msg.text.startsWith('⚠️') ? 'text-red-600' : ''}
          text-[15px] max-w-[330px] break-words
        `}>
          {msg.role === 'bot' ? (
            msg.text.startsWith('⚠️') ? (
              msg.text
            ) : msg.text === '부물AI가 답변을 준비중입니다...' ? (
              <div className="flex items-center gap-2">
                <span className="spinner" />
                <span>{loadingText}{dots}</span>
              </div>
            ) : (
              <MarkdownPreview 
                source={msg.text} 
                style={{ 
                  background: 'transparent', 
                  padding: 0, 
                  boxShadow: 'none', 
                  color: "#1a202c", 
                  fontWeight: 500,
                  whiteSpace: 'pre-wrap'
                }} 
              />
            )
          ) : msg.text}
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
            {loading ? 'Sending..' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
