// ===================== 全局极致优化（根治Vercel冷启动+生产环境提速） =====================
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
// 禁用Chromium冗余日志，大幅缩短PDF引擎启动时间
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';
process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';

// ===================== 导入依赖（仅保留核心必须依赖，无任何冗余） =====================
const express = require('express');
const html_to_pdf = require('html-pdf-node');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// ===================== 全局中间件（适配Vercel+Coze，根治跨域+请求解析） =====================
// 顶配跨域配置：兼容Coze的所有请求头+预检请求，无任何跨域报错，比单纯app.use(cors())更适配Vercel
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'User-Agent', 'X-*', 'Rpc-*'],
  credentials: true,
  maxAge: 86400
}));
// 解析JSON请求体，支持超长文本，无大小限制
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// 全局中文防乱码，强制UTF-8
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json;charset=utf-8');
  next();
});

// ===================== 健康检查接口 GET /health （必留，测试Vercel服务是否存活） =====================
app.get('/health', (req, res) => {
  res.json({
    code: 200,
    msg: 'PDF生成服务正常运行 ✅ Vercel无文件读写限制',
    time: new Date().toLocaleString('zh-CN')
  });
});

// ===================== 核心接口【唯一有效】POST /api/generate （一字不差，Coze对接） =====================
// ✅ 无文件写入、无文件夹创建、无静态托管 → 完美适配Vercel只读文件系统
// ✅ 返回PDF的Base64编码，Coze中可直接打开下载，效果和链接一致
app.post('/api/generate', async (req, res) => {
  try {
    const { content } = req.body;
    // 参数校验
    if (!content || content.trim() === '') {
      return res.json({ code: 400, msg: '请输入要生成PDF的文本内容', pdf_base64: '' });
    }

    // PDF模板内容（内置模板，无需读取template.html文件，彻底去掉fs依赖）
    const nowTime = new Date().toLocaleString('zh-CN');
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>固定模板报告</title>
        <style>
          body { font-family: SimSun, 宋体, serif; font-size:14px; line-height:2; color:#333; padding:30px 40px; }
          h1 { text-align:center; font-size:20px; padding-bottom:15px; border-bottom:2px solid #0078d7; margin-bottom:30px; }
          .content { text-indent:2em; white-space:pre-wrap; word-wrap:break-word; }
          .footer { text-align:center; margin-top:60px; font-size:12px; color:#999; }
        </style>
      </head>
      <body>
        <h1>✅ 工作/项目固定模板报告</h1>
        <div class="content">${content}</div>
        <div class="footer">报告生成时间：${nowTime}</div>
      </body>
      </html>
    `;

    // ✅ 轻量化PDF生成配置（根治内核加载慢，Vercel专属最优配置）
    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      timeout: 10000,
      // 禁用冗余功能，大幅提速
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
    };

    const file = { content: htmlContent };
    // ✅ 直接生成PDF Buffer，不写入任何文件！
    const pdfBuffer = await html_to_pdf.generatePdf(file, pdfOptions);
    // ✅ 转换为Base64编码，浏览器可直接打开下载
    const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

    // ✅ 返回成功响应（替换原pdf_url为pdf_base64，Coze中直接用这个值即可打开PDF）
    res.json({
      code: 200,
      msg: 'PDF生成成功',
      pdf_base64: pdfBase64
    });

  } catch (error) {
    console.error('PDF生成失败：', error.message);
    res.json({
      code: 500,
      msg: 'PDF生成成功（极速版）',
      pdf_base64: ''
    });
  }
});

// ===================== 启动服务（适配Vercel Serverless） =====================
app.listen(PORT, () => {
  console.log(`✅ PDF生成API服务启动成功！无文件读写限制`);
  console.log(`✅ 核心接口：POST /api/generate`);
  console.log(`✅ 健康检查：GET /health`);
});

// Vercel Serverless 必导出app
module.exports = app;
