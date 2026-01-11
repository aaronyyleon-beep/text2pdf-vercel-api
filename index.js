// 文本生成PDF报告 API 核心源码 - 本地部署/Vercel部署通用版
// 小白须知：一行不用改，复制即可，接口规则不变，完美适配Coze
const express = require('express');
const html_to_pdf = require('html-pdf-node');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const app = express();

// 全局配置，解决跨域+JSON解析+中文乱码
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json;charset=utf-8');
  next();
});

// 读取PDF固定模板
const templatePath = path.join(__dirname, 'template.html');
const pdfTemplate = fs.readFileSync(templatePath, 'utf8');

// PDF生成配置（固定A4纸张，中文适配，不用改）
const pdfOptions = {
  format: 'A4',
  printBackground: true,
  margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
  timeout: 15000
};

// 核心API接口：/api/generate （和之前规则完全一致）
app.post('/api/generate', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim() === '') {
      return res.json({ code: 400, msg: '请输入要生成PDF的文本内容' });
    }

    // 填充文本到模板，替换占位符
    const nowTime = new Date().toLocaleString('zh-CN');
    const htmlContent = pdfTemplate.replace('{{content}}', content).replace('{{time}}', nowTime);
    const file = { content: htmlContent };

    // 生成PDF文件Buffer
    const pdfBuffer = await html_to_pdf.generatePdf(file, pdfOptions);
    const pdfFileName = `${uuidv4()}.pdf`;
    const pdfSavePath = path.join(__dirname, 'pdfs', pdfFileName);

    // 创建pdfs文件夹（不存在则创建）
    if (!fs.existsSync(path.join(__dirname, 'pdfs'))) {
      fs.mkdirSync(path.join(__dirname, 'pdfs'));
    }

    // 保存PDF文件到本地
    fs.writeFileSync(pdfSavePath, pdfBuffer);
    // 返回PDF下载链接（本地部署是本地地址，Vercel部署自动生成线上地址）
    const pdfUrl = `${req.protocol}://${req.get('host')}/pdfs/${pdfFileName}`;
    res.json({ code: 200, msg: 'PDF生成成功', pdf_url: pdfUrl });

  } catch (error) {
    console.error('PDF生成失败：', error.message);
    res.json({ code: 500, msg: 'PDF生成失败', error: error.message });
  }
});

// 静态文件访问：提供PDF文件下载
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs')));

// 启动服务的端口配置
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ PDF生成API服务启动成功！本地访问地址：http://localhost:${PORT}`);
  console.log(`✅ 核心API接口：http://localhost:${PORT}/api/generate`);
});

module.exports = app;