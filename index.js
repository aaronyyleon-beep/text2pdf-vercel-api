// 文本生成PDF报告 API 核心源码 - 本地部署/Vercel部署通用版【已优化，解决Coze超时+Vercel文件问题】
// 适配Coze调用：返回Base64格式PDF，无文件写入，零阻塞，极速响应，100%解决超时
const express = require('express');
const html_to_pdf = require('html-pdf-node');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

// 全局配置，解决跨域+JSON解析+中文乱码+长文本适配【调大限制，适配Coze长文本】
app.use(cors()); // 允许所有跨域请求，完美适配Coze
app.use(express.json({ limit: '20mb' })); // 调大解析上限，支持20MB长文本
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json;charset=utf-8');
  next();
});

// 读取PDF固定模板
const templatePath = path.join(__dirname, 'template.html');
const pdfTemplate = fs.readFileSync(templatePath, 'utf8');

// PDF生成配置（固定A4纸张，中文适配，调大超时时间，不用改）
const pdfOptions = {
  format: 'A4',
  printBackground: true,
  margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
  timeout: 30000 // 超时时间调大到30秒，适配复杂长文本生成
};

// 核心API接口：/api/generate （✅ 正确接口地址，无多余后缀）
app.post('/api/generate', async (req, res) => {
  try {
    const { content } = req.body;
    // 校验文本内容
    if (!content || content.trim() === '') {
      return res.json({ 
        code: 400, 
        msg: '请输入要生成PDF的文本内容',
        data: null
      });
    }

    // 填充文本到模板，替换占位符，保留你的原有逻辑
    const nowTime = new Date().toLocaleString('zh-CN');
    const htmlContent = pdfTemplate.replace('{{content}}', content).replace('{{time}}', nowTime);
    const file = { content: htmlContent };

    // 生成PDF文件Buffer（核心逻辑不变）
    const pdfBuffer = await html_to_pdf.generatePdf(file, pdfOptions);
    // ✅ 关键优化：将PDF二进制流转为Base64编码，直接返回给Coze，无需保存文件
    const pdfBase64 = pdfBuffer.toString('base64');

    // ✅ 返回给Coze的最终结果：成功状态+提示+PDF的Base64编码
    res.json({
      code: 200,
      msg: 'PDF生成成功，可直接解析Base64编码生成PDF文件',
      data: {
        pdf_base64: pdfBase64, // 核心字段：PDF的Base64编码
        pdf_type: 'application/pdf', // 文件类型标识
        tip: 'Base64编码可直接转换为PDF文件下载/预览'
      }
    });

  } catch (error) {
    console.error('PDF生成失败：', error.message);
    // 失败返回统一格式，方便Coze解析
    res.json({
      code: 500,
      msg: 'PDF生成失败，请检查文本内容是否过长或格式异常',
      data: null,
      error: error.message
    });
  }
});

// 启动服务的端口配置（本地/Vercel通用，无需修改）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ PDF生成API服务启动成功！本地访问地址：http://localhost:${PORT}`);
  console.log(`✅ 核心API接口：http://localhost:${PORT}/api/generate`);
});

module.exports = app;
