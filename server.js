const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 9000; // 云函数默认端口9000

// 中间件
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/generated', express.static('generated'));

// 确保目录存在
const dirs = ['uploads', 'generated', 'templates/base', 'templates/user', 'fonts', 'emojis'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 静态文件服务
app.use('/templates', express.static('templates'));
app.use('/fonts', express.static('fonts'));
app.use('/emojis', express.static('emojis'));

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片格式：jpeg, jpg, png, gif'));
    }
  }
});

// 模板上传配置
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'templates/user/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const templateUpload = multer({ 
  storage: templateStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片格式：jpeg, jpg, png, gif'));
    }
  }
});

// 表情包上传配置
const emojiStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'emojis/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const emojiUpload = multer({ 
  storage: emojiStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片格式：jpeg, jpg, png, gif, webp'));
    }
  }
});

// 预定义的评语模板
const commentTemplates = [
  "完成得很好，继续保持！",
  "进步明显，值得表扬！",
  "思路清晰，表达准确！",
  "书写工整，态度认真！",
  "还需继续努力！",
  "知识点掌握较好！",
  "可以再仔细一些！",
  "整体表现优秀！"
];

// 路由：获取评语模板
app.get('/api/comments', (req, res) => {
  res.json({ comments: commentTemplates });
});

// 路由：上传单个文件
app.post('/api/upload', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: '文件大小超过限制（最大50MB）',
            code: 'FILE_TOO_LARGE'
          });
        }
        return res.status(400).json({ 
          error: '文件上传错误: ' + err.message,
          code: err.code
        });
      }
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    res.json({
      success: true,
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`,
      size: req.file.size
    });
  });
});

// 路由：批量上传
app.post('/api/upload/batch', (req, res, next) => {
  upload.array('images', 50)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: '文件大小超过限制（最大50MB）',
            code: 'FILE_TOO_LARGE'
          });
        }
        return res.status(400).json({ 
          error: '文件上传错误: ' + err.message,
          code: err.code
        });
      }
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    const files = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      path: `/uploads/${file.filename}`
    }));
    
    res.json({ success: true, files });
  });
});

// 路由：获取模板列表
app.get('/api/templates', (req, res) => {
  try {
    const baseTemplates = [];
    const userTemplates = [];
    
    const baseDir = path.join(__dirname, 'templates/base');
    if (fs.existsSync(baseDir)) {
      const files = fs.readdirSync(baseDir);
      files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
          baseTemplates.push({
            name: file,
            path: `/templates/base/${file}`,
            type: 'base'
          });
        }
      });
    }
    
    const userDir = path.join(__dirname, 'templates/user');
    if (fs.existsSync(userDir)) {
      const files = fs.readdirSync(userDir);
      files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
          userTemplates.push({
            name: file,
            path: `/templates/user/${file}`,
            type: 'user'
          });
        }
      });
    }
    
    res.json({
      success: true,
      base: baseTemplates,
      user: userTemplates
    });
  } catch (error) {
    console.error('获取模板列表错误:', error);
    res.status(500).json({ error: '获取模板列表失败: ' + error.message });
  }
});

// 路由：上传模板
app.post('/api/templates/upload', (req, res, next) => {
  templateUpload.single('template')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: '文件大小超过限制（最大50MB）',
            code: 'FILE_TOO_LARGE'
          });
        }
        return res.status(400).json({ 
          error: '文件上传错误: ' + err.message,
          code: err.code
        });
      }
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    res.json({
      success: true,
      filename: req.file.filename,
      path: `/templates/user/${req.file.filename}`,
      name: req.file.originalname
    });
  });
});

// 路由：删除用户模板
app.delete('/api/templates/user/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'templates/user', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '模板不存在' });
    }
  } catch (error) {
    console.error('删除模板错误:', error);
    res.status(500).json({ error: '删除模板失败: ' + error.message });
  }
});

// 路由：上传自定义表情包
app.post('/api/emojis/upload', (req, res, next) => {
  emojiUpload.single('emoji')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: '文件大小超过限制（最大10MB）',
            code: 'FILE_TOO_LARGE'
          });
        }
        return res.status(400).json({ 
          error: '文件上传错误: ' + err.message,
          code: err.code
        });
      }
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    res.json({
      success: true,
      filename: req.file.filename,
      path: `/emojis/${req.file.filename}`,
      originalname: req.file.originalname,
      size: req.file.size
    });
  });
});

// 路由：获取自定义表情包列表
app.get('/api/emojis', (req, res) => {
  try {
    const emojisDir = path.join(__dirname, 'emojis');
    
    if (!fs.existsSync(emojisDir)) {
      return res.json({ success: true, emojis: [] });
    }
    
    const files = fs.readdirSync(emojisDir);
    const emojis = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      })
      .map(file => {
        const filePath = path.join(emojisDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: `/emojis/${file}`,
          size: stats.size,
          uploadTime: stats.mtime
        };
      })
      .sort((a, b) => b.uploadTime - a.uploadTime);
    
    res.json({ success: true, emojis });
  } catch (error) {
    console.error('获取表情包列表错误:', error);
    res.status(500).json({ error: '获取表情包列表失败: ' + error.message });
  }
});

// 路由：删除自定义表情包
app.delete('/api/emojis/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'emojis', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '表情包不存在' });
    }
  } catch (error) {
    console.error('删除表情包错误:', error);
    res.status(500).json({ error: '删除表情包失败: ' + error.message });
  }
});

// 路由：AI匹配模板
app.post('/api/ai/match-template', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: '缺少图片URL' });
    }
    
    let imageBase64 = null;
    let imageMimeType = 'image/png';
    
    try {
      let imagePath = imageUrl;
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        const urlObj = new URL(imageUrl);
        imagePath = urlObj.pathname;
      }
      
      if (imagePath.startsWith('/uploads/')) {
        imagePath = path.join(__dirname, imagePath.substring(1));
      } else if (imagePath.startsWith('/')) {
        imagePath = path.join(__dirname, imagePath.substring(1));
      }
      
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        
        if (ext === '.jpg' || ext === '.jpeg') imageMimeType = 'image/jpeg';
        else if (ext === '.png') imageMimeType = 'image/png';
        else if (ext === '.gif') imageMimeType = 'image/gif';
        
        imageBase64 = imageBuffer.toString('base64');
      } else {
        console.error('图片文件不存在:', imagePath);
        return res.status(400).json({ error: '图片文件不存在' });
      }
    } catch (fileError) {
      console.error('读取图片文件错误:', fileError);
      return res.status(400).json({ error: '读取图片文件失败: ' + fileError.message });
    }
    
    const base64ImageUrl = `data:${imageMimeType};base64,${imageBase64}`;
    
    let httpImageUrl = null;
    try {
      const host = req.get('host');
      const protocol = req.protocol || 'https';
      let urlPath = imageUrl;
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        const urlObj = new URL(imageUrl);
        urlPath = urlObj.pathname;
      }
      httpImageUrl = `${protocol}://${host}${urlPath}`;
    } catch (urlError) {
      console.warn('构建HTTP URL失败:', urlError);
    }
    
    const host = req.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    
    let finalImageUrl;
    if (isLocalhost) {
      finalImageUrl = base64ImageUrl;
      console.log('检测到本地环境，使用base64格式发送图片');
    } else {
      finalImageUrl = httpImageUrl || base64ImageUrl;
      console.log('检测到公网环境，使用HTTP URL:', finalImageUrl);
    }
    
    const apiRequestBody = {
      model: 'doubao-seed-1-8-251228',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: finalImageUrl
            },
            {
              type: 'input_text',
              text: '请分析这张作业图片的内容、风格和氛围，用一句话描述，并推荐一个适合的背景模板风格（如：温馨、活泼、正式、简洁等）。只返回推荐风格，不要其他内容。'
            }
          ]
        }
      ]
    };
    
    console.log('发送AI API请求，模型:', apiRequestBody.model);
    
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 8edbd9ff-fb77-418f-a374-03b8acdda5e8',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(apiRequestBody)
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('AI API错误响应:', response.status, response.statusText);
      console.error('响应内容:', responseText);
      throw new Error(`AI API请求失败: ${response.status} ${response.statusText}\n响应: ${responseText}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('解析AI API响应失败:', parseError);
      console.error('响应文本:', responseText);
      throw new Error('AI API返回格式错误');
    }
    
    let style = '简洁';
    let styleDescription = '';
    if (data.output && data.output[0] && data.output[0].content) {
      const content = data.output[0].content[0].text || '';
      styleDescription = content.trim();
      if (content.includes('温馨') || content.includes('温暖')) style = '温馨';
      else if (content.includes('活泼') || content.includes('可爱')) style = '活泼';
      else if (content.includes('正式') || content.includes('严肃')) style = '正式';
      else if (content.includes('简洁') || content.includes('简约')) style = '简洁';
    }
    
    console.log('AI分析图片风格:', style, '描述:', styleDescription);
    
    const baseDir = path.join(__dirname, 'templates/base');
    const userDir = path.join(__dirname, 'templates/user');
    const allTemplates = [];
    
    if (fs.existsSync(baseDir)) {
      const files = fs.readdirSync(baseDir);
      files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
          allTemplates.push({
            name: file,
            path: `/templates/base/${file}`,
            type: 'base'
          });
        }
      });
    }
    
    if (fs.existsSync(userDir)) {
      const files = fs.readdirSync(userDir);
      files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
          allTemplates.push({
            name: file,
            path: `/templates/user/${file}`,
            type: 'user'
          });
        }
      });
    }
    
    if (allTemplates.length === 0) {
      return res.json({
        success: true,
        style: style,
        styleDescription: styleDescription,
        recommendedTemplate: null,
        message: '没有可用的模板'
      });
    }
    
    console.log(`找到 ${allTemplates.length} 个模板`);
    
    function selectTemplateByStyle(templates, targetStyle, styleDescription = '') {
      const styleKeywords = {
        '温馨': ['温馨', '温暖', '暖', '家', '爱', '心', '花', '粉色', '红色', '柔和', '温柔', '舒适'],
        '活泼': ['活泼', '可爱', '卡通', '彩色', '亮', '动', '童', '趣味', '生动', '鲜艳', '明快'],
        '正式': ['正式', '严肃', '商务', '专业', '简洁', '简约', '黑白', '灰', '稳重', '端庄'],
        '简洁': ['简洁', '简约', '简单', '纯', '白', '素', '淡', '清', '干净', '清爽', '极简']
      };
      
      const keywords = styleKeywords[targetStyle] || styleKeywords['简洁'];
      
      const scoredTemplates = templates.map(template => {
        let score = 0;
        const nameLower = template.name.toLowerCase();
        
        keywords.forEach(keyword => {
          if (nameLower.includes(keyword.toLowerCase())) {
            score += 2;
          }
        });
        
        if (styleDescription) {
          const descLower = styleDescription.toLowerCase();
          keywords.forEach(keyword => {
            if (descLower.includes(keyword.toLowerCase())) {
              const relatedWords = {
                '温馨': ['花', '心', '爱', '家'],
                '活泼': ['彩', '亮', '动'],
                '正式': ['简', '素', '纯'],
                '简洁': ['白', '纯', '素']
              };
              const related = relatedWords[targetStyle] || [];
              related.forEach(word => {
                if (nameLower.includes(word)) {
                  score += 1;
                }
              });
            }
          });
        }
        
        return { template, score };
      });
      
      scoredTemplates.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (a.template.type === 'user' && b.template.type !== 'user') {
          return -1;
        }
        if (b.template.type === 'user' && a.template.type !== 'user') {
          return 1;
        }
        return 0;
      });
      
      if (scoredTemplates[0].score > 0) {
        console.log(`风格匹配成功，最高分: ${scoredTemplates[0].score}, 模板: ${scoredTemplates[0].template.name}`);
        return scoredTemplates[0].template;
      } else {
        console.log('未找到风格匹配的模板，随机选择');
        return templates[Math.floor(Math.random() * templates.length)];
      }
    }
    
    const recommendedTemplate = selectTemplateByStyle(allTemplates, style, styleDescription);
    
    console.log(`推荐模板: ${recommendedTemplate.name}`);
    
    res.json({
      success: true,
      style: style,
      recommendedTemplate: recommendedTemplate,
      aiResponse: data
    });
  } catch (error) {
    console.error('AI匹配模板错误:', error);
    res.status(500).json({ error: 'AI匹配失败: ' + error.message });
  }
});

// 路由：AI生成评语
app.post('/api/ai/generate-comment', async (req, res) => {
  try {
    const { imageUrl, prompt } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: '缺少图片URL' });
    }
    
    let imageBase64 = null;
    let imageMimeType = 'image/png';
    
    try {
      let imagePath = imageUrl;
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        const urlObj = new URL(imageUrl);
        imagePath = urlObj.pathname;
      }
      
      if (imagePath.startsWith('/uploads/')) {
        imagePath = path.join(__dirname, imagePath.substring(1));
      } else if (imagePath.startsWith('/')) {
        imagePath = path.join(__dirname, imagePath.substring(1));
      }
      
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        
        if (ext === '.jpg' || ext === '.jpeg') imageMimeType = 'image/jpeg';
        else if (ext === '.png') imageMimeType = 'image/png';
        else if (ext === '.gif') imageMimeType = 'image/gif';
        
        imageBase64 = imageBuffer.toString('base64');
      } else {
        return res.status(400).json({ error: '图片文件不存在' });
      }
    } catch (fileError) {
      console.error('读取图片文件错误:', fileError);
      return res.status(400).json({ error: '读取图片文件失败: ' + fileError.message });
    }
    
    const base64ImageUrl = `data:${imageMimeType};base64,${imageBase64}`;
    
    let httpImageUrl = null;
    try {
      const host = req.get('host') || '';
      const protocol = req.protocol || 'https';
      let urlPath = imageUrl;
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        const urlObj = new URL(imageUrl);
        urlPath = urlObj.pathname;
      }
      httpImageUrl = `${protocol}://${host}${urlPath}`;
    } catch (urlError) {
      console.warn('构建HTTP URL失败:', urlError);
    }
    
    const host = req.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    const finalImageUrl = isLocalhost ? base64ImageUrl : (httpImageUrl || base64ImageUrl);
    
    const defaultPrompt = '请根据这张作业图片，生成一句合适的点评评语。评语应该：1. 简洁明了，不超过20个字；2. 积极正面，鼓励为主；3. 针对作业内容给出具体评价。只返回评语内容，不要其他说明。';
    const fullPrompt = prompt || defaultPrompt;
    
    const apiRequestBody = {
      model: 'doubao-seed-1-8-251228',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: finalImageUrl
            },
            {
              type: 'input_text',
              text: fullPrompt
            }
          ]
        }
      ]
    };
    
    console.log('发送AI评语生成请求');
    console.log('使用的提示词:', fullPrompt);
    console.log('图片URL:', finalImageUrl.substring(0, 100) + '...');
    
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 8edbd9ff-fb77-418f-a374-03b8acdda5e8',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(apiRequestBody)
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('AI API错误响应:', response.status, response.statusText);
      console.error('响应内容:', responseText);
      throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('解析AI API响应失败:', parseError);
      throw new Error('AI API返回格式错误');
    }
    
    let comment = '完成得很好，继续保持！';
    console.log('AI API返回数据:', JSON.stringify(data, null, 2));
    
    if (data.output && Array.isArray(data.output)) {
      for (const outputItem of data.output) {
        if (outputItem.type === 'message' && outputItem.content && Array.isArray(outputItem.content)) {
          for (const contentItem of outputItem.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              const content = contentItem.text;
              console.log('提取的评语内容:', content);
              comment = content.trim().replace(/^["'""]|["'""]$/g, '').replace(/\n/g, ' ');
              if (comment.length > 0) {
                break;
              }
            }
          }
          if (comment !== '完成得很好，继续保持！') {
            break;
          }
        }
      }
      
      if (comment === '完成得很好，继续保持！') {
        console.warn('未能从AI API返回数据中提取到评语，使用默认评语');
        console.warn('返回数据结构:', JSON.stringify(data, null, 2));
      }
    } else {
      console.warn('AI API返回数据格式不正确，使用默认评语');
      console.warn('返回数据结构:', JSON.stringify(data, null, 2));
    }
    
    console.log('最终返回的评语:', comment);
    
    res.json({
      success: true,
      comment: comment,
      rawResponse: data
    });
  } catch (error) {
    console.error('AI生成评语错误:', error);
    res.status(500).json({ error: 'AI生成评语失败: ' + error.message });
  }
});

// 路由：获取字体列表
app.get('/api/fonts', (req, res) => {
  try {
    const fontsDir = path.join(__dirname, 'fonts');
    const fonts = [];
    
    if (fs.existsSync(fontsDir)) {
      const files = fs.readdirSync(fontsDir);
      files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
          const fontName = file.replace(/\.[^/.]+$/, '').replace(/\(商用需授权\)/g, '').trim();
          fonts.push({
            name: fontName,
            filename: file,
            path: `/fonts/${file}`,
            displayName: fontName
          });
        }
      });
    }
    
    fonts.unshift({
      name: 'Microsoft YaHei',
      filename: 'default',
      path: 'default',
      displayName: '微软雅黑（默认）'
    });
    
    res.json({
      success: true,
      fonts: fonts
    });
  } catch (error) {
    console.error('获取字体列表错误:', error);
    res.status(500).json({ error: '获取字体列表失败: ' + error.message });
  }
});

// 路由：批量AI生成评语
app.post('/api/ai/generate-comments-batch', async (req, res) => {
  try {
    const { files, prompt } = req.body;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '缺少图片文件列表' });
    }
    
    const results = [];
    
    for (const file of files) {
      try {
        const imageUrl = file.path.startsWith('http') ? file.path : 
                        ((req.protocol || 'https') + '://' + req.get('host') + file.path);
        
        const commentResponse = await fetch((req.protocol || 'https') + '://' + req.get('host') + '/api/ai/generate-comment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageUrl: file.path,
            prompt: prompt
          })
        });
        
        const commentData = await commentResponse.json();
        
        if (commentData.success) {
          results.push({
            success: true,
            filename: file.filename,
            originalname: file.originalname,
            path: file.path,
            comment: commentData.comment
          });
        } else {
          results.push({
            success: false,
            filename: file.filename,
            originalname: file.originalname,
            error: commentData.error || '生成失败'
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        results.push({
          success: false,
          filename: file.filename,
          originalname: file.originalname,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    console.error('批量AI生成评语错误:', error);
    res.status(500).json({ error: '批量生成评语失败: ' + error.message });
  }
});

// 路由：保存编辑后的图片
app.post('/api/save-image', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: '文件大小超过限制（最大50MB）',
            code: 'FILE_TOO_LARGE'
          });
        }
        return res.status(400).json({ 
          error: '文件上传错误: ' + err.message,
          code: err.code
        });
      }
      return res.status(400).json({ error: err.message });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: '没有上传文件' });
      }
      
      const filename = req.body.filename;
      if (!filename) {
        return res.status(400).json({ error: '缺少文件名参数' });
      }
      
      let savedPath = `/uploads/${req.file.filename}`;
      
      res.json({
        success: true,
        filename: req.file.filename,
        path: savedPath,
        message: '图片保存成功'
      });
    } catch (error) {
      console.error('保存图片错误:', error);
      res.status(500).json({ error: '保存图片失败: ' + error.message });
    }
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  console.error('错误堆栈:', error.stack);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: '文件大小超过限制（最大50MB）',
        code: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({ 
      error: '文件上传错误: ' + error.message,
      code: error.code
    });
  }
  
  if (error.message && error.message.includes('只支持图片格式')) {
    return res.status(400).json({ error: error.message });
  }
  
  res.status(500).json({ 
    error: '服务器内部错误',
    message: error.message || '未知错误'
  });
});

// 启动服务器（适配标准Node.js运行时）
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`环境变量 PORT: ${process.env.PORT || '未设置'}`);
  console.log('Express应用已启动');
});

// 导出app和server（用于测试）
module.exports = app;
