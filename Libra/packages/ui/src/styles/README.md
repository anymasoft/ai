# UI Package Styles - Tailwind CSS v4

This directory contains the Tailwind CSS v4 style configuration for the project.

## 📁 File Structure

```
packages/ui/src/styles/
├── globals.css # Main entry file, import all styles
├── theme.css # Theme configuration (colors, animations, shadows, etc.)
├── variables.css # CSS variable definitions (light and dark themes)
├── utils.css # Custom utility classes (glass effect, gradients, etc.)
├── quota.css # Quota-related utility classes
└── README_ZH.md # This document
```

## ✨ Main Features

### 🚀 Tailwind CSS v4 Syntax

- Use the `@utility` directive to define custom utility classes
- Use the `@theme` directive to configure the theme
- Use the `@custom-variant` directive to define custom variants

### 📱 Responsive Design

- Built-in mobile optimization
- Adaptive layout
- Responsive text size

### 🌙 Dark Mode Support

- Automatic system theme detection
- Complete light and dark theme variables

### ♿ Accessibility

- High contrast mode support
- Focus state management
- Semantic structure

## 🛠️ How to Add New Styles

### 1. Add Utility Classes

Use the `@utility` directive in the corresponding CSS file:
```css
@utility my-custom-class {
  @apply bg-primary text-primary-foreground;
  @apply rounded-lg p-4;
}
```

### 2. Add Theme Variables

Add to the `@theme` block in `theme.css`:
```css
@theme inline {
  --color-my-custom: var(--my-custom);
  --spacing-my-custom: 2rem;
}
```

### 3. Add CSS Variables

Define variables in `variables.css`:
```css
:root {
  --my-custom: oklch(50% 0.1 180);
}

.dark {
  --my-custom: oklch(70% 0.1 180);
}
```

### 4. Complex Styles

For complex styles that require media queries, pseudo-classes, etc., use `@layer components`:
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

## 📦 Import New Style Files

If a new style file is created, it needs to be imported in `globals.css`:
```css
@import "tailwindcss";
@import "./utils.css";
@import "./theme.css";
@import "./variables.css";
@import "./quota.css";
@import "./your-new-file.css"; // Add this line
@import "tw-animate-css";
```

## 💡 Best Practices

1. **Use semantic class names**: Choose class names that describe the purpose rather than the appearance
2. **Maintain consistency**: Follow existing naming conventions
3. **Responsive first**: Consider mobile experience
4. **Accessibility**: Ensure styles support assistive technology
5. **Performance optimization**: Avoid overly complex selectors

## 🎯 Quota Style Example

The newly added quota style provides a complete quota management UI component:
```tsx
// Basic usage
<div className="quota-status quota-exhausted">
  <span className="quota-icon">⚠️</span>
  Quota exhausted
</div>

// Quota display in dialog
<div className="quota-dialog-display">
  <div className="quota-text">Current quota</div>
  <div className="quota-status">850/1000</div>
</div>

// Warning message
<div className="quota-warning">
  <span className="quota-warning-icon">⚠️</span>
  <div className="quota-warning-text">Quota about to be exhausted</div>
</div>
```

# Tailwind CSS v4 Directives and Functions Reference

## Overview

Tailwind CSS v4 provides a series of custom directives and functions to enhance CSS functionality and flexibility.

## Directives

Directives are Tailwind-specific at-rules that provide special functionality for Tailwind CSS projects.

### `@import` - Import Styles

Use the `@import` directive to inline import CSS files, including Tailwind itself:
```css
@import "tailwindcss";
```

### `@theme` - Theme Configuration

Use the `@theme` directive to define custom design tokens for your project, such as fonts, colors, and breakpoints:
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

### `@source` - Specify Source Files

Use the `@source` directive to explicitly specify source files that Tailwind's auto-content detection does not recognize:
```css
@source "../node_modules/@my-company/ui-lib";
```

### `@utility` - Custom Utility Classes

Use the `@utility` directive to add custom utility classes to your project, supporting variants like `hover`, `focus`, and `lg`:
```css
@utility tab-4 {
  tab-size: 4;
}
```

### `@variant` - Apply Variants

Use the `@variant` directive to apply Tailwind variants in your CSS:
```css
.my-element {
  background: white;
  @variant dark {
    background: black;
  }
}
```

### `@custom-variant` - Custom Variants

Use the `@custom-variant` directive to add custom variants to your project:
```css
@custom-variant theme-midnight (&:where([data-theme="midnight"] *));
```
This allows you to write utility classes like `theme-midnight:bg-black` and `theme-midnight:text-white`.

### `@apply` - Inline Utility Classes

Use the `@apply` directive to inline existing utility classes into custom CSS:
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
This is useful when you need to write custom CSS, such as overriding third-party library styles, while still using design tokens and familiar syntax.

### `@reference` - Reference Styles

If you want to use `@apply` or `@variant` in Vue or Svelte component `<style>` blocks, or in CSS modules, you need to import theme variables, custom utility classes, and custom variants.

Use the `@reference` directive to reference the main stylesheet without actually including the styles, avoiding duplicate CSS output:
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
If you only use the default theme without custom configuration, you can directly import tailwindcss:
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

## Functions

Tailwind provides the following build-time functions to make color and spacing handling more convenient.

### `--alpha()` - Transparency Adjustment

Use the `--alpha()` function to adjust the transparency of a color:
**Input CSS:**
```css
.my-element {
  color: --alpha(var(--color-lime-300) / 50%);
}
```
**Compiled CSS:**
```css
.my-element {
  color: color-mix(in oklab, var(--color-lime-300) 50%, transparent);
}
```

### `--spacing()` - Spacing Generation

Use the `--spacing()` function to generate spacing values based on the theme:
**Input CSS:**
```css
.my-element {
  margin: --spacing(4);
}
```
**Compiled CSS:**
```css
.my-element {
  margin: calc(var(--spacing) * 4);
}
```
This is also useful for arbitrary values, especially when combined with `calc()`:
```html
<div class="py-[calc(--spacing(4)-1px)]">
  <!-- ... -->
</div>
```

## Compatibility

The following directives and functions are only for compatibility with Tailwind CSS v3.x.

### `@config` - Load Configuration File

Use the `@config` directive to load a traditional JavaScript-based configuration file:
```css
@config "../../tailwind.config.js";
```
> ⚠️ **Note**: v4.0 does not support `corePlugins`, `safelist`, and `separator` options in JavaScript configurations.

### `@plugin` - Load Plugins

Use the `@plugin` directive to load traditional JavaScript-based plugins:
```css
@plugin "@tailwindcss/typography";
```
The `@plugin` directive accepts package names or local paths.

### `theme()` - Theme Value Access

Use the `theme()` function to access Tailwind theme values via dot notation:
```css
.my-element {
  margin: theme(spacing.12);
}
```
> ⚠️ **Deprecated**: This function is deprecated, and it is recommended to use CSS theme variables instead.

## Summary

This document covers all core directives and functions of Tailwind CSS v4. By using these tools, you can:

- 🎨 **Efficiently customize themes**: Use `@theme` and CSS variables to create a consistent design system
- 🔧 **Extend functionality**: Add project-specific styles using `@utility` and `@custom-variant`
- 🚀 **Improve development experience**: Use `@apply` and `@reference` to reuse styles in components
- 📦 **Maintain compatibility**: Use compatibility directives to smoothly migrate existing projects

Prioritize using v4's new syntax and only use compatibility features when necessary.