# UI Package Styles - Tailwind CSS v4

这个目录包含了项目的 Tailwind CSS v4 样式配置。

## 📁 文件结构

```
packages/ui/src/styles/
├── globals.css          # 主入口文件，导入所有样式
├── theme.css           # 主题配置（颜色、动画、阴影等）
├── variables.css       # CSS 变量定义（明暗主题）
├── utils.css          # 自定义工具类（玻璃效果、渐变等）
├── quota.css          # 配额相关的工具类
└── README_ZH.md       # 本文档
```

## ✨ 主要特性

### 🚀 Tailwind CSS v4 语法
- 使用 `@utility` 指令定义自定义工具类
- 使用 `@theme` 指令配置主题
- 使用 `@custom-variant` 定义自定义变体

### 📱 响应式设计
- 内置移动端优化
- 自适应布局
- 响应式文本大小

### 🌙 深色模式支持
- 自动适应系统主题
- 完整的明暗主题变量

### ♿ 可访问性
- 高对比度模式支持
- 焦点状态管理
- 语义化结构

## 🛠️ 如何添加新的样式

### 1. 添加工具类
在相应的 CSS 文件中使用 `@utility` 指令：

```css
@utility my-custom-class {
  @apply bg-primary text-primary-foreground;
  @apply rounded-lg p-4;
}
```

### 2. 添加主题变量
在 `theme.css` 的 `@theme` 块中添加：

```css
@theme inline {
  --color-my-custom: var(--my-custom);
  --spacing-my-custom: 2rem;
}
```

### 3. 添加 CSS 变量
在 `variables.css` 中定义变量：

```css
:root {
  --my-custom: oklch(50% 0.1 180);
}

.dark {
  --my-custom: oklch(70% 0.1 180);
}
```

### 4. 复杂样式
对于需要媒体查询、伪类等复杂样式，使用 `@layer components`：

```css
@layer components {
  .my-complex-component {
    @apply my-custom-class;
  }

  @media (max-width: 768px) {
    .my-complex-component {
      @apply text-sm;
    }
  }
}
```

## 📦 导入新样式文件

如果创建了新的样式文件，需要在 `globals.css` 中导入：

```css
@import "tailwindcss";
@import "./utils.css";
@import "./theme.css";
@import "./variables.css";
@import "./quota.css";
@import "./your-new-file.css";  // 添加这行
@import "tw-animate-css";
```

## 💡 最佳实践

1. **使用语义化的类名**：选择描述用途而非外观的类名
2. **保持一致性**：遵循现有的命名约定
3. **响应式优先**：考虑移动端体验
4. **可访问性**：确保样式支持辅助技术
5. **性能优化**：避免过度复杂的选择器

## 🎯 配额样式示例

新添加的配额样式提供了完整的配额管理 UI 组件：

```tsx
// 基本用法
<div className="quota-status quota-exhausted">
  <span className="quota-icon">⚠️</span>
  配额已耗尽
</div>

// 对话框中的配额显示
<div className="quota-dialog-display">
  <div className="quota-text">当前配额</div>
  <div className="quota-status">850/1000</div>
</div>

// 警告信息
<div className="quota-warning">
  <span className="quota-warning-icon">⚠️</span>
  <div className="quota-warning-text">配额即将耗尽</div>
</div>
```

---

# Tailwind CSS v4 指令和函数参考

## 概述

Tailwind CSS v4 提供了一系列自定义指令和函数，用于增强 CSS 的功能性和灵活性。

---

## 指令 (Directives)

指令是 Tailwind 特有的 **at-rules**，为 Tailwind CSS 项目提供特殊功能。

### `@import` - 导入样式

使用 `@import` 指令内联导入 CSS 文件，包括 Tailwind 本身：

```css
@import "tailwindcss";
```

### `@theme` - 主题配置

使用 `@theme` 指令定义项目的自定义设计令牌，如字体、颜色和断点：

```css
@theme {
  --font-display: "Satoshi", "sans-serif";
  --breakpoint-3xl: 120rem;
  --color-avocado-100: oklch(0.99 0 0);
  --color-avocado-200: oklch(0.98 0.04 113.22);
  --color-avocado-300: oklch(0.94 0.11 115.03);
  --color-avocado-400: oklch(0.92 0.19 114.08);
  --color-avocado-500: oklch(0.84 0.18 117.33);
  --color-avocado-600: oklch(0.53 0.12 118.34);
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
  /* ... */
}
```

> 💡 了解更多关于主题自定义的信息，请参阅主题变量文档。

### `@source` - 指定源文件

使用 `@source` 指令明确指定 Tailwind 自动内容检测未能识别的源文件：

```css
@source "../node_modules/@my-company/ui-lib";
```

> 💡 了解更多关于自动内容检测的信息，请参阅源文件类检测文档。

### `@utility` - 自定义工具类

使用 `@utility` 指令向项目添加自定义工具类，支持 `hover`、`focus` 和 `lg` 等变体：

```css
@utility tab-4 {
  tab-size: 4;
}
```

> 💡 了解更多关于注册自定义工具类的信息，请参阅添加自定义工具类文档。

### `@variant` - 应用变体

使用 `@variant` 指令在 CSS 中应用 Tailwind 变体：

```css
.my-element {
  background: white;
  @variant dark {
    background: black;
  }
}
```

> 💡 了解更多关于使用变体的信息，请参阅使用变体文档。

### `@custom-variant` - 自定义变体

使用 `@custom-variant` 指令在项目中添加自定义变体：

```css
@custom-variant theme-midnight (&:where([data-theme="midnight"] *));
```

这样您就可以编写 `theme-midnight:bg-black` 和 `theme-midnight:text-white` 等工具类。

> 💡 了解更多关于添加自定义变体的信息，请参阅添加自定义变体文档。

### `@apply` - 内联工具类

使用 `@apply` 指令将现有的工具类内联到自定义 CSS 中：

```css
.select2-dropdown {
  @apply rounded-b-lg shadow-md;
}
.select2-search {
  @apply rounded border border-gray-300;
}
.select2-results__group {
  @apply text-lg font-bold text-gray-900;
}
```

这在需要编写自定义 CSS（如覆盖第三方库样式）时非常有用，同时仍能使用设计令牌和熟悉的语法。

### `@reference` - 引用样式

如果您想在 Vue 或 Svelte 组件的 `<style>` 块中，或在 CSS 模块中使用 `@apply` 或 `@variant`，需要导入主题变量、自定义工具类和自定义变体。

使用 `@reference` 指令引用主样式表而不实际包含样式，避免重复输出 CSS：

```vue
<template>
  <h1>Hello world!</h1>
</template>
<style>
  @reference "../../app.css";
  h1 {
    @apply text-2xl font-bold text-red-500;
  }
</style>
```

如果您只使用默认主题而无自定义配置，可以直接导入 tailwindcss：

```vue
<template>
  <h1>Hello world!</h1>
</template>
<style>
  @reference "tailwindcss";
  h1 {
    @apply text-2xl font-bold text-red-500;
  }
</style>
```

---

## 函数 (Functions)

Tailwind 提供以下构建时函数，使颜色和间距处理更加便捷。

### `--alpha()` - 透明度调整

使用 `--alpha()` 函数调整颜色的透明度：

**输入 CSS：**
```css
.my-element {
  color: --alpha(var(--color-lime-300) / 50%);
}
```

**编译后 CSS：**
```css
.my-element {
  color: color-mix(in oklab, var(--color-lime-300) 50%, transparent);
}
```

### `--spacing()` - 间距生成

使用 `--spacing()` 函数基于主题生成间距值：

**输入 CSS：**
```css
.my-element {
  margin: --spacing(4);
}
```

**编译后 CSS：**
```css
.my-element {
  margin: calc(var(--spacing) * 4);
}
```

这在任意值中也很有用，特别是与 `calc()` 结合使用：

```html
<div class="py-[calc(--spacing(4)-1px)]">
  <!-- ... -->
</div>
```

---

## 兼容性

以下指令和函数仅用于与 Tailwind CSS v3.x 的兼容性。

### `@config` - 加载配置文件

使用 `@config` 指令加载基于 JavaScript 的传统配置文件：

```css
@config "../../tailwind.config.js";
```

> ⚠️ **注意**：v4.0 不支持 JavaScript 配置中的 `corePlugins`、`safelist` 和 `separator` 选项。

### `@plugin` - 加载插件

使用 `@plugin` 指令加载基于 JavaScript 的传统插件：

```css
@plugin "@tailwindcss/typography";
```

`@plugin` 指令接受包名或本地路径。

### `theme()` - 主题值访问

使用 `theme()` 函数通过点记法访问 Tailwind 主题值：

```css
.my-element {
  margin: theme(spacing.12);
}
```

> ⚠️ **已弃用**：此函数已弃用，建议使用 CSS 主题变量替代。

---

## 总结

本文档涵盖了 Tailwind CSS v4 的所有核心指令和函数。通过合理使用这些工具，您可以：

- 🎨 **高效定制主题**：使用 `@theme` 和 CSS 变量创建一致的设计系统
- 🔧 **扩展功能**：通过 `@utility` 和 `@custom-variant` 添加项目特定的样式
- 🚀 **提升开发体验**：利用 `@apply` 和 `@reference` 在组件中复用样式
- 📦 **保持兼容性**：使用兼容性指令平滑迁移现有项目

记住始终优先使用 v4 的新语法，仅在必要时使用兼容性功能。