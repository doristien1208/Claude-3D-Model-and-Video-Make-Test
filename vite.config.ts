import { defineConfig } from 'vite';

// compare.html 與 tools/verify/ 只在開發伺服器上使用，正式建置只輸出 index.html
export default defineConfig({
  server: { port: 5173, strictPort: true },
});
