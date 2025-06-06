import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { message } = await req.json()
    console.log('클라이언트 질문:', message)

    const response = await fetch('http://52.78.58.152:2333/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain',
      },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`외부 API 오류: ${response.status} - ${errorText.slice(0, 100)}`)
    }

    // 1. 응답 텍스트 가져오기
    let fullResponse = await response.text()

    // 2. 마크다운 포맷팅 강화
    const processedMarkdown = fullResponse
      .replace(/(\d+)\.\s*\n(\s*\n)+/g, '$1. ') // 번호 다음 빈 줄 제거
      .replace(/(\d+)\.\s+/g, '\n$1. ') // 번호 앞 강제 개행
      .replace(/\n{3,}/g, '\n\n') // 3개 이상 개행 → 2개로 축소
      .replace(/^\s+|\s+$/g, '') // 앞뒤 공백 제거
      .trim()

    console.log('가공된 마크다운:', processedMarkdown.slice(0, 200) + '...')

    return NextResponse.json({ 
      markdown: processedMarkdown || '📭 응답이 비어있습니다.',
      success: true 
    })

  } catch (error) {
    console.error('API 처리 중 오류:', error)
    return NextResponse.json(
      { 
        markdown: `⚠️ 오류 발생: ${error.message.replace(/\\n/g, '\n')}`,
        success: false 
      },
      { status: 500 }
    )
  }
}
