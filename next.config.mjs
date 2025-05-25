/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
      return [
        {
          source: '/api/chat/stream', // 프론트엔드 요청 경로
          destination: 'http://52.78.58.152:2333/chat/stream', // 실제 서버 주소
        },
      ]
    },
    reactStrictMode: true,
  }
  
  export default nextConfig
  