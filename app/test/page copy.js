'use client'
import { useState } from 'react'
import MarkdownPreview from '@uiw/react-markdown-preview'
import remarkGfm from 'remark-gfm'

export default function TestPage() {
  const [input, setInput] = useState(`# 마크다운 테스트

1. 첫 번째 항목
2. 두 번째 항목
3. 세 번째 항목

- 리스트1
- 리스트2

**굵은글씨**  
_기울임_

\`\`\`js
console.log('코드블록');
\`\`\`
`)
  const [result, setResult] = useState('')

  const handleTest = async (e) => {
    e.preventDefault()
    // 단순 POST로 서버에서 마크다운 텍스트를 받아옴
    const res = await fetch('/api/test-markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: input })
    })
    const data = await res.json()
    setResult(data.markdown)
  }

  return (
    <div className="max-w-xl mx-auto mt-12 p-6 bg-white rounded-xl shadow">
      <h2 className="text-xl font-bold mb-4">마크다운 렌더링 테스트</h2>
      <form onSubmit={handleTest} className="mb-6">
        <textarea
          className="w-full border rounded p-2 text-base mb-2"
          rows={10}
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white font-bold px-5 py-2 rounded hover:bg-blue-700"
        >서버로 전송하여 마크다운 테스트</button>
      </form>
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">렌더링 결과</h3>
        <div className="bg-gray-50 p-4 rounded">
          <MarkdownPreview
            source={result || input}
            remarkPlugins={[remarkGfm]}
            className="markdown-body"
            style={{ background: 'transparent', color: '#222', fontSize: 16, whiteSpace: 'pre-wrap' }}
          />
        </div>
      </div>
    </div>
  )
}
