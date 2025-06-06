import { NextResponse } from 'next/server'

export async function POST(req) {
  const { markdown } = await req.json()
  // 실전에서는 마크다운을 검증하거나 조작할 수도 있음
  return NextResponse.json({ markdown })
}
