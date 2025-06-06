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
        'Accept': 'text/plain',
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

    let chunkCount = 0;
    let buffer = '';
    let flushTimer = null;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = fetchResponse.body.getReader();
        const encoder = new TextEncoder();

        const flushBuffer = (force = false) => {
          if (buffer.length === 0) return;

          let sendText = '';
          let boundaryIndex = -1;

          // 1. 우선적으로 개행 문자를 경계로 찾습니다.
          let lastNewlineIndex = buffer.lastIndexOf('\n');
          if (lastNewlineIndex === -1) {
              lastNewlineIndex = buffer.lastIndexOf('\r'); // CRLF (Windows)
          }

          if (lastNewlineIndex !== -1) {
              boundaryIndex = lastNewlineIndex + 1; // 개행 문자까지 포함하여 전송
          } 
          
          // 2. 개행이 없더라도, 버퍼에 일정 길이 이상 쌓였으면 전송합니다.
          // 첫 응답 속도를 위해 이 기준을 더 낮게 설정했습니다.
          const MIN_CHUNK_LENGTH = 5; // 기존 40자에서 10자로 대폭 단축

          if (boundaryIndex !== -1) { // 개행 경계를 찾은 경우
            sendText = buffer.substring(0, boundaryIndex);
            buffer = buffer.substring(boundaryIndex);
          } else if (buffer.length >= MIN_CHUNK_LENGTH || force) { // 개행은 없지만 최소 길이 충족 또는 강제 전송
            // 단어 단위로 쪼개는 것을 시도 (한글 단어 잘림 방지를 위해 주의)
            // 여기서는 단순히 최소 길이 이상이면 전부 전송하거나,
            // 안전하게는 공백(띄어쓰기)을 기준으로 자를 수 있습니다.
            // 현재는 띄어쓰기 없이 바로 최소 길이로 자르는 방식으로 진행
            
            // 만약 한글 단어 잘림이 걱정된다면, 여기서는 최소 길이일 때만 자르고,
            // 마지막 공백(띄어쓰기)을 찾아 자르는 방식으로 변경할 수 있습니다.
            // 예: `let lastSpaceIndex = buffer.lastIndexOf(' ', MIN_CHUNK_LENGTH);`
            // 이 예시에서는 단순하게 처리합니다.
            sendText = buffer;
            buffer = '';
          } else {
            return; // 보낼 만큼 쌓이지 않았다면 대기
          }
          
          // 전송할 텍스트의 앞뒤 불필요한 공백/개행 정리 (내부 마크다운 문법은 유지)
          sendText = sendText.replace(/^[\s\r\n]+/, '').replace(/[\s\r\n]+$/, '');
          
          if (sendText) {
            chunkCount++;
            console.log(`[SSE][${requestId}] 전달 청크 #${chunkCount}:`, sendText);
            controller.enqueue(encoder.encode(`data: ${sendText}\n\n`));
          }
          
          flushTimer = null;
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const textChunk = new TextDecoder().decode(value, { stream: true });
            buffer += textChunk;

            // 데이터가 들어올 때마다 버퍼를 즉시 플러시 시도
            flushBuffer();

            // 타임아웃 처리 (지연된 응답 방지). 더 짧게 설정했습니다.
            if (!flushTimer && buffer.length > 0) {
              flushTimer = setTimeout(() => {
                flushBuffer(true); // 강제 전송
              }, 50); // 100ms에서 50ms로 단축
            }
          }

          // 스트림 종료 시, 버퍼에 남아있는 모든 잔여 데이터 전송
          if (buffer.length > 0) {
            flushBuffer(true); // 남은 데이터 강제 전송
          }
          
          controller.enqueue(encoder.encode('event: done\ndata: \n\n'));
        } catch (error) {
          console.error(`[SSE][${requestId}] 스트림 처리 중 에러:`, error);
          controller.error(error);
        } finally {
          if (flushTimer) clearTimeout(flushTimer);
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
    return new Response(`event: error\ndata: ${error.message}\n\n`, {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });
  } finally {
    console.log(`[SSE][${requestId}] === 요청 처리 완료 ===`);
  }
}