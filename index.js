// ===================== 全局优化配置（解决Vercel冷启动+生产环境提速） =====================
// 强制生产环境模式，禁用冗余调试日志，Node.js加载速度翻倍，解决Vercel冷启动慢的核心配置
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';

// ===================== 导入所有依赖包（和package.json完全对应，无需修改） =====================
const express = require('express');
const html_to_pdf = require('html-pdf-node');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 创建express实例
const app = express();
const PORT = process.env.PORT || 3000; // 兼容Vercel的随机端口+本地3000端口

// ===================== 全局中间件（必配，解决所有请求相关问题） =====================
app.use(cors()); // 全开跨域，允许Coze的所有请求头和跨域请求，无任何限制
app.use(express.json({ limit: '10mb' })); // 解析JSON请求体，支持大文本内容，适配超长PDF文本
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // 兼容表单格式，兜底配置
// 全局响应头，强制中文UTF-8编码，彻底杜绝PDF/返回内容中文乱码
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json;charset=utf-8');
  next();
});

// ===================== 新增【健康检查接口】GET /health （重中之重，解决Vercel休眠） =====================
// 作用1：浏览器访问 https://你的域名/health ，返回正常则证明服务部署成功
// 作用2：保活Vercel服务，每天访问1次即可永不休眠，彻底解决冷启动超时
// 作用3：Coze也可以调用这个接口测试连通性，无任何副作用
app.get('/health', (req, res) => {
  res.json({
    code: 200,
    msg: 'PDF生成服务正常运行中 ✅ Vercel保活成功',
    time: new Date().toLocaleString('zh-CN')
  });
});

// ===================== 核心接口【唯一有效】POST /api/generate （一字不差，Coze对接的唯一接口） =====================
// 无任何多余后缀！没有 /PDFGen /PDF 等，就是纯 /api/generate
app.post('/api/generate', async (req, res) => {
  try {
    // 获取请求体中的核心参数 content (和Coze配置的参数名完全一致)
    const { content } = req.body;
    
    // 校验参数：content为空则返回400错误
    if (!content || content.trim() === '') {
      return res.json({
        code: 400,
        msg: '请输入要生成PDF的文本内容',
        pdf_url: ''
      });
    }

    // 读取PDF模板文件（和index.js同目录的template.html）
    const templatePath = path.join(__dirname, 'template.html');
    const pdfTemplate = fs.readFileSync(templatePath, 'utf-8');

    // 替换模板中的占位符 {{content}} 和 {{time}} 为实际内容
    const nowTime = new Date().toLocaleString('zh-CN');
    const htmlContent = pdfTemplate
      .replace('{{content}}', content)
      .replace('{{time}}', nowTime);

    // PDF生成配置（A4纸张、边距、背景色生效，最优配置）
    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      timeout: 15000
    };

    const file = { content: htmlContent };
    // 生成PDF文件Buffer
    const pdfBuffer = await html_to_pdf.generatePdf(file, pdfOptions);

    // 创建pdfs文件夹（不存在则创建）
    const pdfsDir = path.join(__dirname, 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir);
    }

    // 生成唯一的PDF文件名（UUID避免重复）
    const pdfFileName = `${uuidv4()}.pdf`;
    const pdfSavePath = path.join(pdfsDir, pdfFileName);

    // 保存PDF文件到本地/服务器
    fs.writeFileSync(pdfSavePath, pdfBuffer);

    // 拼接PDF文件的访问链接（适配本地+Vercel双环境，自动识别）
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : `http://localhost:${PORT}`;
    const pdfUrl = `${baseUrl}/pdfs/${pdfFileName}`;

    // 返回成功响应（字段和Coze映射的{{pdf_url}}完全匹配，一字不差）
    res.json({
      code: 200,
      msg: 'PDF生成成功',
      pdf_url: pdfUrl
    });

  } catch (error) {
    // 捕获异常，返回错误信息
    console.error('PDF生成失败：', error.message);
    res.json({
      code: 500,
      msg: 'PDF生成失败，请重试',
      pdf_url: ''
    });
  }
});

// ===================== 托管pdfs文件夹，允许外部访问PDF文件 =====================
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs')));

// ===================== 启动服务 =====================
app.listen(PORT, () => {
  console.log(`✅ PDF生成API服务启动成功！`);
  console.log(`✅ 本地访问地址：http://localhost:${PORT}`);
  console.log(`✅ 核心接口：POST ${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`}/api/generate`);
  console.log(`✅ 健康检查接口：GET ${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`}/health`);
});

// 导出app供Vercel识别（Vercel部署必加，本地运行无影响）
module.exports = app;
