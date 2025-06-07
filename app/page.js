'use client'
import { useState, useRef, useEffect } from 'react'
import { TbMessageChatbot, TbUser } from "react-icons/tb"
import MarkdownPreview from '@uiw/react-markdown-preview'
import remarkGfm from 'remark-gfm'

const RECOMMENDED_QUESTIONS = [
  "24년 12월 공덕 대장 아파트 실거래가 알려주세요.",
  "전세자금 대출의 대출금 사용 용도는 제한이 있나요?",
  "신한은행 전세 대출 금리 알려주세요",
  "강남 출퇴근 용이한 지역 중 저렴한 곳 추천해줄 수 있을까?",
  "서울숲리버뷰자이의 최근 실거래가는?",
  "고정 금리와 변동 금리의 차이점은 무엇인가요?",
  "전체 은행 대상으로 전세대출 금리 알려주세요."
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

  // --- 로딩 애니메이션 효과를 위한 state 및 ref 추가 ---
  const [loadingText, setLoadingText] = useState('답변 준비중');
  const [dots, setDots] = useState('.');
  const loadingInterval = useRef(null);
  const streamInterval = useRef(null);
  const stepTimeout = useRef(null);
  // ---------------------------------------------

  useEffect(() => {
    setRecommended(RECOMMENDED_QUESTIONS
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)) // 추천 질문 중 3개만 랜덤으로 보여줍니다.
  }, [])

  // --- 로딩 애니메이션 및 페이크 스트리밍 효과 ---
  useEffect(() => {
    const cleanup = () => {
      clearInterval(loadingInterval.current);
      clearInterval(streamInterval.current);
      clearTimeout(stepTimeout.current);
      setLoadingText('답변 준비중');
      setDots('.');
    };

    if (loading) {
      const PLANNING_STEPS = [
        "활용될 툴을 찾고 있습니다.",
        "네, 말씀해주신 내용을 바탕으로 기능을 우선 검색하겠습니다.",
        "해당 되는 답변은 다음과 같습니다."
      ];
      let currentStep = -1; // -1에서 시작하여 초기 메시지("답변 준비중")를 표시

      const nextStep = () => {
        currentStep++;
        
        if (currentStep >= PLANNING_STEPS.length) {
            setLoadingText(PLANNING_STEPS[PLANNING_STEPS.length - 1]);
            return;
        }

        const stepText = PLANNING_STEPS[currentStep];
        const words = stepText.split(' ');
        let currentWordIndex = 0;
        let fullText = '';
        
        clearInterval(streamInterval.current);

        streamInterval.current = setInterval(() => {
          if (currentWordIndex < words.length) {
            fullText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
            setLoadingText(fullText);
            currentWordIndex++;
          } else {
            clearInterval(streamInterval.current);
            stepTimeout.current = setTimeout(nextStep, 1500); // 다음 단계 전 1.5초 대기
          }
        }, 120); // 타이핑 속도
      };

      setLoadingText('답변 준비중');
      loadingInterval.current = setInterval(() => {
        setDots(prev => (prev.length >= 3 ? '.' : prev + '.'));
      }, 500);
      
      stepTimeout.current = setTimeout(nextStep, 800); // 0.8초 후 첫 단계 시작

    } else {
        cleanup();
    }
    return cleanup;
  }, [loading]);
  // -------------------------------------------

  useEffect(() => {
    // 컴포넌트가 언마운트될 때 EventSource 연결을 정리합니다.
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    // 새 메시지가 추가되거나 로딩 상태가 변경될 때 맨 아래로 스크롤합니다.
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input;
    setInput('')
    setLoading(true)

    const newMessages = isFirstQuestion 
      ? [{ role: 'user', text: userMessage }]
      : [...messages, { role: 'user', text: userMessage }];

    setIsFirstQuestion(false)
    setMessages([...newMessages, { role: 'bot', text: 'thinking' }])
    
    try {
      const eventSource = new EventSource(`/api/chat/stream?message=${encodeURIComponent(userMessage)}`)
      eventSourceRef.current = eventSource
    
      eventSource.onmessage = (event) => {
        try {
            const parsedData = JSON.parse(event.data);
            if (parsedData.token) {
                setMessages(prev => {
                    const updatedMessages = [...prev];
                    const lastMsg = updatedMessages[updatedMessages.length - 1];
                    
                    if (lastMsg && lastMsg.role === 'bot') {
                        const currentText = lastMsg.text === 'thinking' 
                            ? '' 
                            : lastMsg.text;
                        
                        let newText = currentText + parsedData.token;
                        
                        newText = newText.replace(/([.!?다])(\s*)(\d+\.)/g, '$1\n$3');
                        
                        updatedMessages[updatedMessages.length - 1] = { ...lastMsg, text: newText };
                    }
                    return updatedMessages;
                });
            }
        } catch (err) {
            console.error('Failed to parse message data:', event.data, err);
        }
      }

      const closeStream = () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setLoading(false);
      }

      eventSource.addEventListener('done', () => {
        closeStream();
      })

      eventSource.addEventListener('error', (event) => {
        let errorMsg = '서버 처리 중 문제가 발생했습니다.';
        if (event.data) {
          try {
            const errorData = JSON.parse(event.data);
            errorMsg = errorData.message || errorMsg;
          } catch { /* 파싱 실패 시 기본 메시지 사용 */ }
        }
        setMessages(prev => {
            const filtered = prev.filter(m => m.text !== 'thinking');
            return [...filtered, { role: 'bot', text: `⚠️ 오류 발생: ${errorMsg}` }]
        });
        closeStream();
      })

      eventSource.onerror = (e) => {
        if (eventSource.readyState === EventSource.CLOSED) {
            setLoading(false);
            return;
        }
        setMessages(prev => {
            const filtered = prev.filter(m => m.text !== 'thinking');
            return [...filtered, { role: 'bot', text: '⚠️ 네트워크 연결이 불안정합니다. 다시 시도해 주세요.' }];
        });
        closeStream();
      }
    } catch (err) {
      setMessages(prev => {
          const filtered = prev.filter(m => m.text !== 'thinking');
          return [...filtered, { role: 'bot', text: `⚠️ 시스템 오류: ${err.message}` }];
      });
      setLoading(false);
    }
  }

  const handleRecommendedClick = (q) => {
      setInput(q)
  }

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
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-[15px] mb-1 ${msg.role === 'user' ? 'text-[#171717]' : 'text-[#4092bf]'}`}>
          {msg.role === 'user' ? '질문자' : '부물AI'}
        </div>
        <div className={`px-4 py-2 rounded-lg font-medium text-[15px] ${msg.role === 'user' ? 'bg-[#f4f6fa]' : 'bg-[#f8fafc] border border-gray-200'}`}>
          {msg.role === 'bot' ? (
            msg.text === 'thinking' ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="spinner" />
                  <span>{loadingText}{dots}</span>
                </div>
            ) : msg.text.startsWith('⚠️') ? (
                <span className="text-red-600">{msg.text}</span>
            ) : (
              // [수정] data-color-mode와 인라인 스타일로 텍스트 색상을 강제 적용합니다.
              <div className="markdown-body" data-color-mode="light">
                <MarkdownPreview
                  source={msg.text}
                  remarkPlugins={[remarkGfm]}
                  style={{
                    background: 'transparent',
                    padding: '0',
                    color: '#1a202c' // 질문자 텍스트와 동일한 색상 강제 적용
                  }}
                />
              </div>
            )
          ) : (
            <span className="text-[#1a202c] break-words">{msg.text}</span>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#f4f6fa]">
      <div className="bg-white p-7 m-3 rounded-2xl border border-[#e5e7eb] w-full max-w-[440px] min-h-[600px] flex flex-col shadow-sm">
        <div className="flex flex-col pb-6">
          <h2 className="font-bold text-xl text-[#171717] mb-1">부물AI 챗봇</h2>
          <p className="text-base text-[#2d3748] font-medium">부동산 도우미 AI 챗봇입니다.</p>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-1 w-full">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {isFirstQuestion && messages.length <= 1 && (
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
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : '전송'}
          </button>
        </form>
      </div>
    </div>
  )
}
