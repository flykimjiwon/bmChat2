import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request) {
  const requestId = Date.now();
  console.log(`[SSE][${requestId}] === 새 요청 시작 ===`);

  try {
    const { searchParams } = new URL(request.url);
    const message = searchParams.get('message');
    console.log(`[SSE][${requestId}] 쿼리 파라미터:`, { message });

    const fetchResponse = await fetch('http://52.78.58.152:2333/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ message }),
    });

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      console.error(`[SSE][${requestId}] ❌ 외부 서버 에러 응답`, {
        status: fetchResponse.status,
        body: errorText,
      });
      throw new Error(`외부 서버 오류: ${fetchResponse.status}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = fetchResponse.body.getReader();
        const decoder = new TextDecoder('utf-8');
        const encoder = new TextEncoder();
        let buffer = '';
        let chunkCount = 0;
        const MIN_CHUNK_SIZE = 10; // 최소 전송 단위

        // '총 N개' 패턴을 감지하는 정규식
        // \s는 공백 문자를 의미하며, \d+는 하나 이상의 숫자를 의미합니다.
        // (?<!\n)는 부정적인 후방 탐색으로, 바로 앞에 줄바꿈 문자가 없는 경우에만 일치합니다.
        const totalCountRegex = /(?<!\n)총\s\d+개/; 

        function enqueueJson(data) {
          const jsonString = JSON.stringify(data);
          controller.enqueue(encoder.encode(`data: ${jsonString}\n\n`));
          chunkCount++;
          console.log(`[SSE][${requestId}] 전달 청크 #${chunkCount}:`, data.token.trim());
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let newlineIndex;
            // 우선순위 1: 줄바꿈이 있으면 라인 단위로 전송
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              let line = buffer.slice(0, newlineIndex + 1);
              buffer = buffer.slice(newlineIndex + 1);
              
              // '총 N개' 패턴이 포함된 줄을 찾아서 앞에 줄바꿈 추가
              if (totalCountRegex.test(line) && chunkCount > 0) {
                line = '\n' + line; // 줄바꿈 추가
              }

              if (line.trim()) {
                enqueueJson({ token: line });
              }
            }
            
            // 우선순위 2: 줄바꿈이 없더라도, 버퍼에 쌓인 데이터가 최소 길이를 넘으면 전송
            if (buffer.length >= MIN_CHUNK_SIZE) {
               // '총 N개' 패턴이 포함된 경우 앞에 줄바꿈 추가
              if (totalCountRegex.test(buffer) && chunkCount > 0) {
                buffer = '\n' + buffer; // 줄바꿈 추가
              }
              enqueueJson({ token: buffer });
              buffer = ''; // 버퍼 비우기
            }
          }

          // 스트림 종료 후 버퍼에 남은 데이터가 있으면 모두 전송
          if (buffer.length > 0) {
            // 스트림 마지막에 '총 N개' 패턴이 남아있을 경우 줄바꿈 추가
            if (totalCountRegex.test(buffer) && chunkCount > 0) {
                buffer = '\n' + buffer; // 줄바꿈 추가
            }
            enqueueJson({ token: buffer });
          }
          
          controller.enqueue(encoder.encode('event: done\ndata: {"status": "completed"}\n\n'));

        } catch (error) {
          console.error(`[SSE][${requestId}] 스트림 처리 중 에러:`, error);
          const errorPayload = { message: '스트림 처리 중 오류가 발생했습니다.', details: error.message };
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(errorPayload)}\n\n`));
          controller.error(error);
        } finally {
          reader.releaseLock();
          controller.close();
          console.log(`[SSE][${requestId}] 스트림 리소스 정리 완료`);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error(`[SSE][${requestId}] ❌ 최종 에러 발생:`, error);
    const errorPayload = { message: error.message };
    return new Response(`event: error\ndata: ${JSON.stringify(errorPayload)}\n\n`, {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  } finally {
    console.log(`[SSE][${requestId}] === 요청 처리 완료 ===`);
  }
}