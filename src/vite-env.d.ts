/// <reference types="vite/client" />

// 声明 CSS 模块类型
declare module "*.css" {
  const content: string;
  export default content;
}

// 声明其他静态资源类型
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.gif" {
  const content: string;
  export default content;
}

declare module "*.webp" {
  const content: string;
  export default content;
}

// 声明 @fontsource 包类型
declare module "@fontsource/*" {
  const content: string;
  export default content;
}

