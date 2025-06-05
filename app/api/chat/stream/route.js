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

        // 자연어 경계 판단 함수 (개선 버전)
        // const findBoundary = (str) => {
        //   const boundaries = ['\n', '.', ' ', '!', '?', ',', ';', ':', '1.', '2.', '3.', '4.', '5.'];

        //   // 숫자 항목 시작점 우선 탐색
        //   const listPattern = /\n\d+\. /g;
        //   const listMatch = [...str.matchAll(listPattern)].pop();
        //   if (listMatch) return listMatch.index + listMatch[0].length;

        //   // 일반 경계 문자 탐색
        //   for (let i = str.length - 1; i >= 0; i--) {
        //     if (boundaries.some(b => str.startsWith(b, i))) return i + 1;
        //   }
        //   return -1;
        // };
        // route.js 내 findBoundary 함수 수정
        const findBoundary = (str) => {
            // 개선된 번호 목록 탐지 (예: "1. ", "2. ")
            const listPattern = /(\n|^)\d+\.\s/g;
            const listMatch = [...str.matchAll(listPattern)].pop();
            if (listMatch) {
              return listMatch.index + listMatch[0].length;
            }
          
            // 기존 경계 탐지 로직
            for (let i = str.length - 1; i >= 0; i--) {
              if (['\n', '.', '!', '?', ';'].includes(str[i])) {
                return i + 1;
              }
            }
            return -1;
          };
          
  

  const flushBuffer = () => {
    if (buffer.length === 0) return;
  
    const boundaryIndex = findBoundary(buffer);
    let sendText = boundaryIndex > 0 
      ? buffer.substring(0, boundaryIndex)
      : buffer;
  
    // === 여기서 번호 목록 앞 개행/공백 제거 ===
    // 예: "\n3. " 또는 "   3. " → "3. "
    sendText = sendText.replace(/^[\s\r\n]*(\d+\.\s)/, '$1');
    
  
    if (sendText) {
      chunkCount++;
      console.log(`[SSE][${requestId}] 전달 청크 #${chunkCount}:`, sendText);
      controller.enqueue(encoder.encode(`data: ${sendText}\n\n`));
      buffer = buffer.substring(sendText.length);
    }
  
    flushTimer = null;
  };
  

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += new TextDecoder().decode(value, { stream: true });

            // 즉시 전송 조건 강화 (40자 이상 or 경계 존재)
            if (buffer.length >= 40 || findBoundary(buffer) !== -1) {
              flushBuffer();
            }

            // 타임아웃 처리 (100ms)
            if (!flushTimer) {
              flushTimer = setTimeout(() => {
                if (buffer.length > 0) flushBuffer();
              }, 100);
            }
          }

          // 잔여 데이터 처리
          flushBuffer();
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
