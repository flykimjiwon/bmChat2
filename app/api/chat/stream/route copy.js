// app/api/chat/stream/route.js
import { NextResponse } from 'next/server'

export const runtime = 'nodejs' // Edge Runtime에서는 스트림이 안 됨

export async function POST(req) {
  try {
    const body = await req.json()
    console.log('[API] 요청 body:', body)

    const fetchResponse = await fetch('http://52.78.58.152:2333/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain',
      },
      body: JSON.stringify(body),
    })

    // 외부 서버 응답 상태 상세 로그
    console.log('[API] fetch status:', fetchResponse.status, fetchResponse.statusText)

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text()
      console.error('[API] 외부 서버 에러 응답:', fetchResponse.status, fetchResponse.statusText)
      console.error('[API] 외부 서버 에러 본문:', errorText)
      return new NextResponse(
        `External Server Error: ${fetchResponse.status}\n${errorText}`,
        { status: 500 }
      )
    }

    // 스트림 응답을 그대로 반환
    return new NextResponse(fetchResponse.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    // 전체 에러 객체를 상세하게 출력
    console.error('[API] 프록시 처리 중 예외 발생:', error)
    return new NextResponse(
      `Internal Server Error\n${error?.stack ?? error?.message ?? error}`,
      { status: 500 }
    )
  }
}
