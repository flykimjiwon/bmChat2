import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request) {
  const requestId = Date.now()
  console.log(`[SSE][${requestId}] === 새 요청 시작 ===`)

  try {
    const { searchParams } = new URL(request.url)
    const message = searchParams.get('message')
    console.log(`[SSE][${requestId}] 쿼리 파라미터:`, { message })

    const fetchResponse = await fetch('http://52.78.58.152:2333/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain',
      },
      body: JSON.stringify({ message }),
    })

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text()
      console.error(`[SSE][${requestId}] ❌ 외부 서버 에러 응답`, {
        status: fetchResponse.status,
        body: errorText
      })
      throw new Error(`외부 서버 오류: ${fetchResponse.status}`)
    }

    let chunkCount = 0

    const stream = new ReadableStream({
      async start(controller) {
        const reader = fetchResponse.body.getReader()
        const encoder = new TextEncoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunkCount++
            const decodedValue = new TextDecoder().decode(value)
            console.log(`[SSE][${requestId}] 청크 수신 #${chunkCount}:`, decodedValue)
            const sseData = `data: ${decodedValue}\n\n`
            controller.enqueue(encoder.encode(sseData))
          }
          // 스트림 정상 종료 시 done 이벤트 전송
          controller.enqueue(encoder.encode('event: done\ndata: \n\n'))
        } catch (streamError) {
          console.error(`[SSE][${requestId}] 스트림 처리 중 에러:`, streamError)
          controller.error(streamError)
        } finally {
          reader.releaseLock()
          controller.close()
          console.log(`[SSE][${requestId}] 스트림 리소스 정리 완료`)
        }
      }
    })

    console.log(`[SSE][${requestId}] 클라이언트에 SSE 응답 반환`)
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error(`[SSE][${requestId}] ❌ 최종 에러 발생:`, error)
    return new Response(`event: error\ndata: ${error.message}\n\n`, {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    })
  } finally {
    console.log(`[SSE][${requestId}] === 요청 처리 완료 ===`)
  }
}
