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

    let buffer = '';
    let chunkCount = 0;
    let flushTimer = null;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = fetchResponse.body.getReader();
        const encoder = new TextEncoder();

        // 1. 개선된 경계 탐색 로직
        const findBoundary = (str) => {
          const boundaries = ['\n', '. ', '! ', '? ', ', ', '; ', ' ', '1. ', '2. ', '3. ', '4. ', '5. '];
          let bestIndex = -1;

          // 우선 순위 1: 리스트 항목 시작점
          for (const pattern of ['\n1. ', '\n2. ', '\n3. ', '\n4. ', '\n5. ']) {
            const index = str.lastIndexOf(pattern);
            if (index !== -1) {
              bestIndex = index + pattern.length;
              break;
            }
          }
          if (bestIndex !== -1) return bestIndex;

          // 우선 순위 2: 일반 문장 경계
          for (let i = str.length - 1; i >= 0; i--) {
            if (boundaries.some(b => str.startsWith(b, i))) {
              bestIndex = i + 1;
              break;
            }
          }

          // 우선 순위 3: 3바이트 이하 한글 분할 방지
          if (bestIndex === -1 && str.length > 3) {
            const lastChar = str.slice(-3);
            if (Buffer.byteLength(lastChar) === 3) { // 한글 완성형 확인
              bestIndex = str.length - 3;
            }
          }

          return bestIndex;
        };

        // 2. 버퍼 플러시 로직
        const flushBuffer = () => {
          if (buffer.length === 0) return;

          let boundaryIndex = findBoundary(buffer);
          let sendText = '';

          if (boundaryIndex > 0) {
            sendText = buffer.substring(0, boundaryIndex);
            buffer = buffer.substring(boundaryIndex);
          } else if (buffer.length >= 60) { // 버퍼 최대 길이 60자로 제한
            sendText = buffer.substring(0, 60);
            buffer = buffer.substring(60);
          }

          if (sendText) {
            // 3. 리스트 항목 강제 개행 처리
            sendText = sendText.replace(/(\d+\. )/g, '\n$1');
            
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

            buffer += new TextDecoder().decode(value, { stream: true });

            // 4. 플러시 조건: 버퍼가 20자 이상이거나 경계 존재
            if (buffer.length >= 20 && findBoundary(buffer) !== -1) {
              flushBuffer();
            }

            // 5. 타임아웃 조정 (80ms)
            if (!flushTimer) {
              flushTimer = setTimeout(() => {
                if (buffer.length > 0) flushBuffer();
              }, 80);
            }
          }

          // 잔여 데이터 처리
          while (buffer.length > 0) {
            flushBuffer();
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
