## 用Obsidian来学习语言！

公告：已经开放discussion区，一般的问题可以先在这里进行讨论。

### 早期阶段
当前插件还处在早期开发阶段，因此有以下事情需要注意：
+ **目前仅支持中文母语者学习英文**。
+ 因为还在不断的扩充新功能和重构旧功能，所以可能某次更新会带来与之前**不兼容的改变**（比如笔记的格式，数据库的结构等）。所以在更新新版本前请仔细查看release的说明。


### 使用指南
+ [文字教程](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/tutorial.pdf)
+ [视频教程](https://www.bilibili.com/video/BV1914y1Y7mT)
+ [一些做好的文本](https://github.com/guopenghui/language-learner-texts)
+ @emisjerry 制作的使用教程: [Youtube](https://www.youtube.com/watch?v=lK3oFpUg7-o), [Bilibili](https://www.bilibili.com/video/BV1N24y1k7SL/)



### 本插件功能

+ **查词功能**。直接在笔记中划词查词，词典为有道词典，支持柯林斯例句、近义词辨析。
+ **添加笔记**。数据被保存在obsidain的indexDB数据库中。每个单词/短语支持多条笔记、多条例句（包括文本、翻译和出处）
+ **解析页面**。将每个单词变成一个按钮，通过点击就可以边读边查边记笔记。如果有音频链接的话可以边听边读。
+ **统计页面**。目前支持显示7天内每天自己记的单词数和总的单词数。

联动其他插件功能：
+ 联动various complements插件，将数据库中的单词保存在本地的一个note中。这样就可以在写作时得到自己之前记过的单词/短语的**自动提示和补全**
+ 联动spaced repetition插件，将数据库中的单词保存在本地的note中。这样就可以制作成卡片，进行**间隔复习**。

### 外观展示
阅读：

![阅读界面](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/reading.png)

单词列表：
![单词列表](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/table.png)

自动补全/提示：

![自动补全-英中](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/complement1.png)
![自动补全-中英](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/complement2.png)

间隔复习：

![间隔复习](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/review.png)




## 安装

+ 从realease下载压缩包`obsidian-language-leaner.zip`
+ 解压到obsidian库的`.obsidian/plugins/`文件夹下，即保证`main.js`的路径为`.obsidian/plugins/obsidian-language-learner/main.js`
+ 打开obsidian，在插件中启用本插件`Language Learner`.
+ 配置见[使用指南](#使用指南)
## 自行构建

下载源码到本地
```shell
git clone https://github.com/guopenghui/obsidian-language-learner.git
```

进入文件夹，运行
```shell
cd obsidian-language-learner
# 安装依赖
npm install 
# 构建 会自动压缩代码体积
npm run build 
```

## 问题或建议
欢迎大家提交issue：
+ bug反馈
+ 对新功能的想法
+ 对已有功能的优化

可能有时作者暂时比较忙，或是对于提出的功能需求暂时没想到好的实现方法而没有一一回复。

但是只要提了issue都会看的，所以大家有想法或反馈直接发到issue就行。


## 新鼠标
在鼠标寿命到头，左键时灵时不灵的艰难的环境下完成了0.0.1版的发布。😭

觉得这款插件好用的朋友，或是想鼓励一下作者，可以赞助孩子买个新鼠标!!🖱

![微信](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/wechat.jpg)
![支付宝](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/alipay.jpg)

---

## 扩展功能

### 数据存储优化

#### Markdown 文件存储（推荐）

新增 Markdown 文件存储方式，相比原有的 IndexedDB 有以下优势：

- **支持 Obsidian Sync**：单词数据可以通过 Obsidian 的同步功能在多设备间同步
- **可直接查看编辑**：数据存储在普通的 Markdown 文件中，用户可以直接打开查看和编辑
- **支持 Git 版本控制**：可以将单词数据纳入版本管理
- **数据迁移**：支持从 IndexedDB 一键迁移到 Markdown 文件

在设置中选择"存储方式"为"Markdown 文件"，并设置文件路径即可使用。

---

### 阅读模式增强

#### 一键格式化文章

点击侧边栏的"格式化为阅读模式"按钮，自动为当前文章：

1. 添加 `langr: true` 属性标记
2. 添加 `^^^article` 内容分隔符
3. 添加 `^^^words` 生词区域
4. 添加 `^^^notes` 笔记区域
5. 弹出音频文件选择器（可选）

#### 分页导航

阅读页面底部新增分页组件：

- 显示当前页码和总页数
- 支持直接点击页码跳转
- 支持切换每页显示段数（1/2/4/8/16 段或全部）
- 自动记录阅读位置，下次打开自动定位

#### 阅读样式设置

功能区新增样式设置按钮，支持实时调整：

- **字号**：12px - 28px
- **行距**：1.0 - 3.0
- **字距**：-0.1em - 0.5em

---

### 本地音频播放

支持在阅读模式下播放本地音频文件，边听边读。

#### 使用方法

1. **格式化文章时设置音频**：
   - 点击侧边栏"格式化为阅读模式"按钮
   - 弹出音频文件选择器，选择音频文件
   - 支持格式：mp3, wav, ogg, m4a, flac, aac, wma
   - 按 Esc 可跳过不设置

2. **为已有文章设置音频**：
   - 打开命令面板 (Ctrl/Cmd + P)
   - 搜索"设置文章音频"
   - 选择音频文件

#### 音频路径格式

音频以相对路径存储在 frontmatter 中，`~/` 表示知识库根目录：

```yaml
---
langr: true
langr-audio: ~/audio/my-audio.mp3
---
```

阅读页面会自动解析并显示音频播放器。